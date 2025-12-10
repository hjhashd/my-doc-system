import os
# -*- coding: utf-8 -*-
import sys
import time
import importlib

# sys.path.append('/data/report_generation_mainrun_produce')
sys.path.append('./fast_api/')
import aiohttp
import asyncio
from fastapi import FastAPI, HTTPException, BackgroundTasks
from pydantic import BaseModel
import uvicorn
from typing import List, Dict, Any, Optional
import logging
from collections import defaultdict, deque
from datetime import datetime, timedelta
import pandas as pd
from sqlalchemy import text
import Split_PDF_documents_to_image_API
import Remove_red_seal_API
import Remove_watermark_and_intelligent_high_definition_API
import PP_StructureV3_batch_img_API
import layout_parsing_batch_img_API

from pathlib import Path
import json_feature_extraction_api


from docx import Document
from docx.shared import Inches
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT




# 配置日志
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()

# 存储任务状态的字典
# 键为task_id，值为字典，包含状态、进度、结果等信息
api_tasks = {}


# 这是前端要给到的参数？？？
# 定义请求模型 - 【修改点1】添加category字段
class ReportRequest(BaseModel):
    task_id: str
    status: int
    agentUserId: int
    file_name: str
    input_file_path: str
    output_file_path: str
    


# 非阻塞超时通知发送函数
async def send_timeout_notification(task_id, timeout_result):
    """
    异步发送超时通知，确保不阻塞监控任务

    参数:
    task_id (str): 报告ID
    timeout_result (dict): 包含超时状态信息的字典
    """
    try:
        # 发送100%进度的失败通知
        await notify_processing_status(100, task_id, timeout_result)
        logger.info(f"已成功发送任务 {task_id} 的超时通知")
    except Exception as e:
        logger.error(f"发送任务 {task_id} 超时通知失败: {e}")


async def notify_processing_status(process_percentage, task_id, task_result):
    """
    异步发送处理进度通知到指定接口
    参数:
    process_percentage (int): 处理进度百分比
    task_id (str): 报告ID
    task_result (dict): 包含任务结果信息的字典
    返回:
    dict: 接口响应结果
    """
    url = "https://ai.faithindata.com.cn/stage-api/report/entity/notice/process"
    task_id_str = str(task_id)
    task_id_int = int(task_id)

    print("process_percentage::", process_percentage)
    print("task_result::", task_result)
    payload = {
        "filePath": task_result['file_path'],
        "process": process_percentage,
        "id": task_id_int,
        "report_generation_status": task_result['report_generation_status'],
    }
    print("payload::", payload)
    headers = {
        "Content-Type": "application/json"
    }

    # 更新内部任务状态
    if task_id_str in api_tasks:
        api_tasks[task_id_str]["progress"] = process_percentage

    # 设置完成状态
    # 只有在进度为100%时才标记为已完成，其他任何情况都是未完成
    if process_percentage == 100:
        is_completed = 1  # 标记为已完成
    else:
        is_completed = 0  # 其他所有情况（包括进度为60%）都标记为未完成

    # 使用异步HTTP客户端发送通知
    async with aiohttp.ClientSession() as session:
        try:
            async with session.post(url, json=payload, headers=headers) as response:
                response.raise_for_status()
                result = await response.text()
                logger.info(f"进度通知成功: {process_percentage}%, 报告ID: {task_id}")
                print("req_result::", result)
                return result
        except aiohttp.ClientError as e:
            logger.error(f"通知进度失败: {e}")
            return {"error": str(e)}


# 超时监控函数
async def monitor_task_timeout(task_id):
    """
    监控任务是否超时的异步函数
    - 在120分钟时发送超时失败通知
    - 如果任务在120分钟内完成，不发送失败通知
    - 使用非阻塞方式发送通知

    参数:
    task_id (str): 报告ID，用于识别和跟踪任务
    """
    # 获取开始时间和状态信息
    start_time = api_tasks[task_id]["start_time"]
    status = api_tasks[task_id].get("status_code", 0)  # 使用status_code存储原始状态码

    # 计算120分钟超时阈值
    timeout_threshold = start_time + timedelta(minutes=120)
    formatted_start_time = start_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    logger.info(f"开始监控任务 {task_id}，超时阈值设置为120分钟，当前时间: {formatted_start_time}")

    while True:
        # 任务已不存在或已被移除的检查
        if task_id not in api_tasks:
            logger.info(f"任务 {task_id} 已完成或已被取消，停止监控")
            return

        # 任务已完成或失败的检查
        if api_tasks[task_id].get("status") in ["completed", "failed"]:
            logger.info(f"任务 {task_id} 已完成或失败，状态为: {api_tasks[task_id].get('status')}，停止监控")
            return

        # 检查是否已标记为超时
        if api_tasks[task_id].get("timeout_flag", False):
            logger.info(f"任务 {task_id} 已被标记为超时，停止监控")
            return

        # 检查是否超时
        current_time = datetime.now()
        if current_time > timeout_threshold:
            elapsed_time = (current_time - start_time).total_seconds() / 60.0
            logger.error(
                f"任务 {task_id} 已超时（>120分钟）！开始时间: {formatted_start_time}, 已运行: {elapsed_time:.2f}分钟")

            # 标记为超时
            api_tasks[task_id]["timeout_flag"] = True
            api_tasks[task_id]["status"] = "failed"
            api_tasks[task_id]["error"] = "处理时间超过120分钟"

            # 准备超时结果
            timeout_result = {
                "report_generation_status": 1,  # 错误状态码
                "report_generation_condition": "报告生成失败：处理时间超过120分钟",
                "file_path": None,
                "status": status
            }

            # 更新任务结果
            api_tasks[task_id]["result"] = timeout_result

            # 异步发送超时通知，不等待其完成
            asyncio.create_task(send_timeout_notification(task_id, timeout_result))
            logger.info(f"已创建异步通知任务，任务 {task_id} 的超时监控现在结束")
            return  # 结束监控任务

            await notify_processing_status(100, task_id, timeout_result)
        # 每10秒检查一次
        await asyncio.sleep(10)


async def PDF_TO_WORD(pdf_input_path, pdf_out_path, task_id, file_name, agentUserId):
    # 记录开始处理时间
    process_start_time = datetime.now()
    formatted_start_time = process_start_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    logger.info(f"task开始时间: {formatted_start_time}, 任务ID: {task_id}, 如果处理时间超过120分钟将自动终止")

    # 创建任务专用的记录和初始化状态
    if task_id not in api_tasks:
        api_tasks[task_id] = {}

    # 给任务赋值
    api_tasks[task_id]["timeout_flag"] = False
    api_tasks[task_id]["start_time"] = process_start_time
    api_tasks[task_id]["status"] = "processing"

    # # 启动专属超时监控任务
    timeout_monitor_task = asyncio.create_task(monitor_task_timeout(task_id))

    # 记录开始等待时间
    wait_start_time = datetime.now()
    formatted_wait_time = wait_start_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    logger.info(f"后台任务已创建，等待3秒后开始处理 ID: {task_id}, 当前时间: {formatted_wait_time}")
    # 等待3秒再开始实际处理
    await asyncio.sleep(1)

    # 记录等待结束时间
    wait_end_time = datetime.now()
    formatted_end_time = wait_end_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    logger.info(f"3秒等待结束，开始处理报告 ID: {task_id}, 当前时间: {formatted_end_time}")

    # 功能程序运行前先指定状态
    task_result = {
        "report_generation_status": 1,
        "report_generation_condition": '报告生成失败',
        "file_path": pdf_out_path,
    }

    try:
        # 首先异步发送进度通知
        await notify_processing_status(0, task_id, task_result)
        await asyncio.sleep(1)
        # 更新进度
        await notify_processing_status(30, task_id, task_result)

        logger.info(f"pdf_to_img start!!!!")
        # 调用Split_PDF_documents_to_image_API 进行PDF分页
        # task_status_return = await Split_PDF_documents_to_image_API.pdf_to_img(
        #     pdf_path=pdf_input_path,
        #     out_img_path=pdf_out_path+"/pdf_to_img",
        #     dpi=400,  # 追求极致清晰可设为600（注意：文件会显著变大，处理变慢）
        #     img_format="png"  # 无损格式，保留所有细节
        # )

        await notify_processing_status(40, task_id, task_result)

        # 去除背景水印并且智能高清
        # params = Remove_watermark_and_intelligent_high_definition_API.WatermarkParams(
        #     gray_min=140, gray_max=240, sat_max=40,
        #     inpaint_radius=40, dilate_iter=1,
        #     sharp_strength=1.5, clahe_clip=2.0, clahe_grid=(8, 8),
        #     smooth_ksize=3, feather=5
        # )
        
        # await Remove_watermark_and_intelligent_high_definition_API.remove_watermark_to_files(
        #     input_path=pdf_out_path+"/pdf_to_img",  # 输入文件夹
        #     out_clean=pdf_out_path + "/clean",  # 输出文件夹（保持同名）
        #     out_hd=pdf_out_path + "/hd",  # 输出文件夹（保持同名）
        #     params=params,
        #     only_enhance=False,
        #     recursive=False
        # )

        # await notify_processing_status(60, task_id, task_result)

        # 去除红色（印章）
        # await Remove_red_seal_API.remove_red_seal_batch(
        #     # input_path=Remove_watermark_out_img_path+"hd/",
        #     input_path=pdf_out_path + "/hd",
        #     output_path=pdf_out_path + "/remove_red_seal_batch",  # 批量输出文件夹
        #     Threshold_adjustment_coefficient=1.0  # 调整阈值系数（适合浅红色印章）
        # )

        await notify_processing_status(70, task_id, task_result)

        # OCR文本抽取
        in_dir = Path(pdf_input_path)
        output_path = Path(pdf_out_path) / file_name
        layout_parsing_batch_img_API.process_images(in_dir, output_path)
        
        json_dir = Path(pdf_out_path) / file_name
        img_dir =  Path(pdf_out_path+"/img")
        table_dir = Path(pdf_out_path+"/table")
        out_docx_dir = Path(pdf_out_path+"/")

        print(json_dir)
        print(img_dir)
        print(table_dir)
        print(out_docx_dir)

        # 构造 Web 前缀 (Root-Relative Path)
        # 注意：这里不需要 img/ 或 table/，因为 API 内部会自己加
        web_path_prefix = f"/save/{agentUserId}/{task_id}"
        
        # 调用生成函数
        _, task_status_return = json_feature_extraction_api.generate_word_from_jsons(
            json_dir,
            img_dir,
            table_dir,
            out_docx_dir,
            url_prefix=web_path_prefix  # <--- 传入这个新参数
        )


        # 程序执行成功时给前端的返回
        if task_status_return == True:
            task_result = {
                "report_generation_status": 0,
                "report_generation_condition": task_status_return,
                "file_path": pdf_out_path,
            }

        # 更新任务完成状态
        if task_id in api_tasks:
            api_tasks[task_id]["status"] = "completed"
            api_tasks[task_id]["result"] = task_result
            # 清除超时标志，因为任务已正常完成
            api_tasks[task_id]["timeout_flag"] = False

        await notify_processing_status(100, task_id, task_result)

    # 程序执行失败时给前端的返回
    except Exception as e:
        logger.error(f"报告生成失败: {e}")
        logger.error(f"异常堆栈信息:", exc_info=True)
        # 更新任务失败状态
        if task_id in api_tasks:
            api_tasks[task_id]["status"] = "failed"
            api_tasks[task_id]["error"] = str(e)
            api_tasks[task_id]["result"] = {
                "report_generation_status": 1,
                "report_generation_condition": f"报告生成失败: {str(e)}",
                "file_path": None,
            }

        # 尝试发送100%进度通知，表示任务已结束（即使是失败）
        try:
            error_result = {
                "report_generation_status": 1,
                "report_generation_condition": f"报告生成失败: {str(e)}",
                "file_path": None,
            }
        
            await notify_processing_status(100, task_id, error_result)
        except Exception as notify_error:
            logger.error(f"发送失败进度通知出错: {notify_error}")


# API接口
# 该接口是后端的 “入口”：
@app.post("/generate_report/")
async def generate_report(report: ReportRequest, background_tasks: BackgroundTasks):
    '''
    report 是变量
    ReportRequest 是属性
    '''
    """
    API接口
    """
    print('888888888888   我是接收的请求参数   8888888888888', report)

    # 记录请求接收时间
    from datetime import datetime
    request_time = datetime.now()
    formatted_request_time = request_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

    print(
        f'========================= 接收新的请求 [{formatted_request_time}] =================================')
    print(f'接收到的参数：{report}')

    # 输入文件的路径,说明输入文件的存储路径的上一级目录，真实路径存储在下一级的agentUserId/task_ids命名的目录下面，如input_file_path是"./input/",agentUserId是1001,task_id是2，输入的文件就存储在./pdf_output/1001/2/下面
    input_base_path = report.input_file_path
    input_pdf_id_path = os.path.join(input_base_path,str(report.agentUserId),report.task_id)  # 在input_file_path下使用agentUserId/task_id作为专用文件夹
    
    # 对传入文件名的前缀名称和后缀进行分离
    file_name_without_ext, file_ext = os.path.splitext(report.file_name)
    # 对文件后缀名称file_ext进行判断，待续完善
    # 拼凑出输入文件的绝对路径
    input_pdf_id_dir = os.path.join(input_pdf_id_path, f'{file_name_without_ext+file_ext}')

    #输出文件的路径，说明输出文件的路径存储的上一级目录，真实路径存储在下一级的agentUserId/task_id命名的目录下面，如output_file_path是"./pdf_output/",agentUserId是1001,task_id是2，输出的文件就存储在./pdf_output/1001/2/下面
    output_base_dir = report.output_file_path
    output_pdf_id_path = os.path.join(output_base_dir,str(report.agentUserId) ,report.task_id)  # 在output_file_path下使用agentUserId/task_id作为专用文件夹
    os.makedirs(output_pdf_id_path, exist_ok=True)  # 确保目录存在
    print(f"处理文件将保存到: {output_pdf_id_path}")



    try:
        # 【核心修改】直接使用category查询数据库，不再进行名称转换
        logger.info(f"API请求{report.task_id}")

        # 将报告生成任务添加到后台任务，传递计算后的 charts
        # 将任务添加到后台任务，fast api 调用本地的参数的入口，以及传参

        background_tasks.add_task(
            PDF_TO_WORD,
            task_id=report.task_id,
            pdf_input_path=input_pdf_id_dir,
            pdf_out_path=output_pdf_id_path,
            file_name=file_name_without_ext,
            agentUserId=report.agentUserId
        )

        # 初始化响应，返回给前端的参数
        default_response = {
            "report_generation_status": 0,
            "report_generation_condition": "报告请求已接受，正在后台处理中",
            "file_path": input_pdf_id_dir,
            "status": report.status,
        }

        # 记录日志
        logger.info(f"报告生成请求已接受，后台处理中: {report.task_id}")
        print("返回参数：", default_response)
        # 立即返回响应
        return default_response

    except Exception as e:
        # 记录错误
        error_time = datetime.now()
        formatted_error_time = error_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        logger.error(f"接收请求失败 [{formatted_error_time}]: {e}")

        # 如果创建了任务状态记录，则更新为失败
        if report.task_id in api_tasks:
            api_tasks[report.task_id]["status"] = "failed"
            api_tasks[report.task_id]["error"] = str(e)

        # 错误响应，使用空 charts 或请求值
        error_response = {
            "report_generation_status": 1,  # 表示处理完成
            "report_generation_condition": f"报告请求处理失败: {str(e)}",
            "file_path": input_pdf_id_dir,
            "status": report.status,
        }
        print("错误返回参数：", error_response)
        return error_response


# 查询状态的接口，状态的 “查询入口”：
# 获取任务状态的API（可选，用于客户端查询任务进度）
@app.get("/report_status/{task_id}")
async def get_report_status(task_id: str):
    """
    获取报告生成任务状态的API接口
    这个接口允许客户端查询指定报告的生成进度和状态。

    参数:
    task_id (str): 报告ID

    返回:
    dict: 包含任务状态信息的响应
    """
    if task_id not in api_tasks:
        raise HTTPException(status_code=404, detail="找不到该报告任务")

    task_info = api_tasks[task_id]
  
    # 如果任务已完成，返回最终结果
    if task_info["status"] == "completed" and task_info["result"]:
        return task_info["result"]

    # 否则返回当前状态
    return {
        "report_generation_status": 2,  # 2表示处理中
        "report_generation_condition": f"报告生成中，当前进度: {task_info['progress']}%",
        "status": "processing",
        "progress": task_info["progress"],
        "error": task_info["error"],
    }


# 健康检查端点
@app.get("/health")
async def health_check():
    """
    系统健康检查API接口

    这个接口提供系统当前状态的基本信息，用于监控和诊断。
    返回:
    dict: 包含系统健康状态的信息
    """
    active_tasks = len([task for task_id, task in api_tasks.items() if task["status"] == "processing"])
    return {
        "status": "healthy",
        "active_tasks": active_tasks,
        "total_tasks": len(api_tasks)
    }


if __name__ == "__main__":
    logger.info("启动完全基于数据库配置的动态报告生成服务")
    logger.info("系统特性：")
    logger.info("  - 支持动态报告类型配置")
    logger.info("  - 支持动态章节配置")
    logger.info("  - 支持动态模块导入")
    logger.info("  - 支持队列管理和超时监控")
    logger.info("  - 无需代码修改即可添加新报告类型")
    uvicorn.run(app, host="0.0.0.0", port=11111)

