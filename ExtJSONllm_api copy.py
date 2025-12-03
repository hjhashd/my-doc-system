import os
# -*- coding: utf-8 -*-
import sys
import time
import importlib

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
from datetime import datetime
from pathlib import Path
from utils.extract_llm_utils import build_schema,load_schema_map,json_fallback_extract,save_json
from doc_utils import load_and_split_document # 引用共享模块



# 配置日志
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

app = FastAPI()
api_tasks = {}
# 这是前端要给到的参数
class ReportRequest(BaseModel):
    task_id: str
    status: int
    agentUserId: int
    content: str
    schema_map: str
    output_json_file: str   
    
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


async def notify_processing_status(process_percentage, task_id, report_result):
    """
    异步发送处理进度通知到指定接口
    参数:
    process_percentage (int): 处理进度百分比
    task_id (str): 报告ID
    report_result (dict): 包含报告结果信息的字典
    返回:
    dict: 接口响应结果
    """
    url = "https://ai.faithindata.com.cn/stage-api/report/entity/notice/process"
    task_id_str = str(task_id)
    task_id_int = int(task_id)

    print("process_percentage::", process_percentage)
    print("report_result::", report_result)
    payload = {
        "filePath": report_result['file_path'],
        "process": process_percentage,
        "id": task_id_int,
        "report_generation_status": report_result['report_generation_status'],
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


async def extract_json(task_id,content,schema,output_json_file):
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

    #启动专属超时监控任务
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
    report_result = {
        "report_generation_status": 1,
        "report_generation_condition": '报告生成失败',
        "file_path": output_json_file,
    }

    try:
        # 首先异步发送进度通知
        # await notify_processing_status(0, task_id, report_result)
        await asyncio.sleep(1)
        # 更新进度
        # await notify_processing_status(30, task_id, report_result)
        logger.info(f"extract_json start!!!!")
        # await notify_processing_status(40, task_id, report_result)


        print("\n--- 阶段一：将字符串转换为JSON格式 ---")
        schema_stage1 = build_schema(schema)
        print("\n--- 阶段二：转换schema的格式 ---")
        schema_forllm = load_schema_map(schema_stage1)
        print("\n--- 阶段三：使用Ollama进行LLM提取 ---")
        merged = json_fallback_extract(
            content,
            schema_forllm,
        )
        task_status_return = save_json(merged,output_json_file)

        # 程序执行成功时给前端的返回
        if task_status_return == True:
            report_result = {
                "report_generation_status": 0,
                "report_generation_condition": task_status_return,
                "file_path": output_json_file,
            }

        # 更新任务完成状态
        if task_id in api_tasks:
            api_tasks[task_id]["status"] = "completed"
            api_tasks[task_id]["result"] = report_result
            # 清除超时标志，因为任务已正常完成
            api_tasks[task_id]["timeout_flag"] = False

        await notify_processing_status(100, task_id, report_result)

    # 程序执行失败时给前端的返回
    except Exception as e:
        logger.error(f"生成json失败: {e}")
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
                "report_generation_condition": f"json生成失败: {str(e)}",
                "file_path": None,
            }
        
            await notify_processing_status(100, task_id, error_result)
        except Exception as notify_error:
            logger.error(f"发送失败进度通知出错: {notify_error}")


# API接口
# 该接口是后端的 “入口”：
@app.post("/extract_Attribute/")
async def extract_Attribute(report: ReportRequest, background_tasks: BackgroundTasks):
    '''
    report 是变量
    ReportRequest 是属性
    '''
    """
    API接口
    """
    # 记录请求接收时间
    request_time = datetime.now()
    formatted_request_time = request_time.strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
    print(f'接收到的参数：{report}')

    #输出文件的路径，最终为.json文件
    output_base_dir = report.output_json_file 
    os.makedirs(output_base_dir, exist_ok=True)
    output_json_id_path = os.path.join(output_base_dir, f"{report.task_id}.json")
    report.output_json_file = output_json_id_path
    print(f"处理文件将保存到: {report.output_json_file}")

    try:
        logger.info(f"API请求{report.task_id}")
        background_tasks.add_task(
            extract_json,
            task_id=report.task_id,
            content=report.content,
            schema=report.schema_map,
            output_json_file=report.output_json_file,
        )

        # 初始化响应，返回给前端的参数
        default_response = {
            "report_generation_status": 0,
            "report_generation_condition": "生成json请求已接受，正在后台处理中",
            "file_path": report.output_json_file,
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
    logger.info("接受前端文本框中的内容生成文档类别词")
    uvicorn.run(app, host="0.0.0.0", port=16326)

