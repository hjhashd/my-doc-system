
import os, json, traceback, time
from typing import Optional, Dict, Any, List, Callable
from fastapi import FastAPI, BackgroundTasks, Query
from pydantic import BaseModel, Field

# ===== 显式常量定义 =====
DEFAULT_OUTPUT_FILE_PATH: str = "/data/cwd_cq/out"
DEFAULT_INPUT_FILE_PATH: str = "/home/xzh/ocr_flie/pdf_output"
DEFAULT_RUN_PICTURE: bool = True
DEFAULT_USE_MERGED_FOR_MERGE: bool = True

# ===== 导入你的源文件 =====
import title_recognition as mod_title_rec
import title_position_calculator as mod_pos
import clear_empty_blocks_manager as mod_clear
import table_recognition as mod_table
import table_title_completely_merge_with_content as mod_merge
from picture_recognition import EnhancedImageProcessor

# ===== 服务常量 =====
RUN_HTTP_SERVER: bool = True
SERVER_HOST: str = "0.0.0.0"
SERVER_PORT: int = 8005
SERVER_WORKERS: int = 1

# ===== 全局任务状态存储 =====
GLOBAL_TASK_STORE: Dict[str, Dict[str, Any]] = {}

# ============== 工具函数 ==============
def _abspath(p: Optional[str]) -> Optional[str]:
    return os.path.abspath(p) if p else None

def _assert_file_exists(p: str, name: str):
    if not os.path.isfile(p):
        raise FileNotFoundError(f"{name} 不存在: {p}")

def _build_output_dir(output_file_path: str, agent_user_id: int, task_id: str) -> str:
    output_dir = os.path.join(output_file_path, str(agent_user_id), str(task_id))
    os.makedirs(output_dir, exist_ok=True)
    return output_dir

def _wrap_blocks_if_needed(merged_path: str, json_file_name: str, output_dir: str) -> str:
    with open(merged_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    if isinstance(data, dict) and "blocks" in data:
        return merged_path
    if isinstance(data, list):
        wrapped = {"blocks": data}
        os.makedirs(output_dir, exist_ok=True)
        wrapped_path = os.path.join(output_dir, f"{json_file_name}_blocks_merge_wrapped.json")
        with open(wrapped_path, "w", encoding="utf-8") as wf:
            json.dump(wrapped, wf, ensure_ascii=False, indent=2)
        return _abspath(wrapped_path)
    return merged_path

# ============== 缓存检查逻辑 ==============
def check_cache_result(req_data: 'PipelineRequest') -> Optional[Dict[str, Any]]:
    """
    检查输出目录下是否已经存在关键文件。
    如果存在，直接构造并返回成功的 result 字典；否则返回 None。
    """
    try:
        output_dir = _build_output_dir(req_data.output_file_path, req_data.agentUserId, req_data.task_id)
        file_base_name = os.path.splitext(req_data.file_name)[0]
        
        # 检查最关键的完成标志文件 (Step5)
        final_table_path = os.path.join(output_dir, f"{file_base_name}_tables_with_heading.json")
        if not os.path.exists(final_table_path):
            return None
            
        print(f"[Cache Hit] 检测到现有结果文件: {final_table_path}")

        def get_path_if_exists(suffix: str) -> Optional[str]:
            p = os.path.join(output_dir, f"{file_base_name}{suffix}")
            return _abspath(p) if os.path.exists(p) else None

        file_outputs = {
            "step1_title_recognition": {
                "step_name": "标题识别", 
                "file_path": get_path_if_exists(".json"),
                "file_name": f"{file_base_name}.json",
                "description": "识别文档中的标题及其层级结构"
            },
            "step2_title_position_blocks": {
                "step_name": "标题定位与切块", 
                "file_path": get_path_if_exists("_blocks.json"), 
                "file_name": f"{file_base_name}_blocks.json",
                "description": "根据标题位置将文档切分为多个块"
            },
            "step3_blocks_merge": {
                "step_name": "空块合并", 
                "file_path": get_path_if_exists("_blocks_merge.json"), 
                "file_name": f"{file_base_name}_blocks_merge.json",
                "description": "合并文档中的空白块"
            },
            "step3_blocks_merge_wrapped": {
                "step_name": "空块合并（包装版）", 
                "file_path": get_path_if_exists("_blocks_merge_wrapped.json"),
                "file_name": f"{file_base_name}_blocks_merge_wrapped.json",
                "description": "包装后的空块合并结果"
            },
            "step4_table_recognition": {
                "step_name": "表格识别", 
                "file_path": get_path_if_exists("_tables.json"), 
                "file_name": f"{file_base_name}_tables.json",
                "description": "识别文档中的所有表格及其内容"
            },
            "step5_tables_with_heading": {
                "step_name": "表格标题合并", 
                "file_path": get_path_if_exists("_tables_with_heading.json"), 
                "file_name": f"{file_base_name}_tables_with_heading.json",
                "description": "将标题元数据合并到表格信息中"
            },
            "step6_picture_recognition": {
                "step_name": "图片识别", 
                "file_path": get_path_if_exists("_picture.json"), 
                "file_name": f"{file_base_name}_picture.json",
                "description": "识别文档中的图片及关键信息"
            }
        }

        return {
            "ok": True, 
            "status": 1, 
            "message": "检测到已存在的文件，跳过处理直接返回结果 (Cache Hit)",
            "file_outputs": file_outputs, 
            "meta": {
                "document_name": file_base_name, 
                "task_id": req_data.task_id, 
                "agent_user_id": req_data.agentUserId, 
                "output_directory": output_dir,
                "input_file_path": req_data.input_file_path
            }, 
            "log": ["✅ [Cache] 检测到输出文件已存在，跳过流水线执行。"],
            "config": {"output_directory": output_dir}
        }
    
    except Exception as e:
        print(f"[Cache Error] 检查缓存时出错: {e}")
        return None

# ============== 🔥 完整核心流程（从原文件恢复） 🔥 ==============
def run_pipeline_sync(
        file_path: str,
        task_id: str,
        agent_user_id: int,
        output_file_path: str,
        input_file_path: str = DEFAULT_INPUT_FILE_PATH,
        run_picture: bool = DEFAULT_RUN_PICTURE,
        use_merged_blocks_for_merge: bool = DEFAULT_USE_MERGED_FOR_MERGE,
        progress_callback: Callable[[str, int, str], None] = None
) -> Dict[str, Any]:
    def report_progress(step_key: str, percent: int, desc: str):
        if progress_callback:
            progress_callback(step_key, percent, desc)

    output_dir = _build_output_dir(output_file_path, agent_user_id, task_id)
    
    file_outputs = {
        "step1_title_recognition": {"step_name": "标题识别", "file_path": None, "file_name": None, "description": ""},
        "step2_title_position_blocks": {"step_name": "标题定位与切块", "file_path": None, "file_name": None, "description": ""},
        "step3_blocks_merge": {"step_name": "空块合并", "file_path": None, "file_name": None, "description": ""},
        "step3_blocks_merge_wrapped": {"step_name": "空块合并（包装版）", "file_path": None, "file_name": None, "description": ""},
        "step4_table_recognition": {"step_name": "表格识别", "file_path": None, "file_name": None, "description": ""},
        "step5_tables_with_heading": {"step_name": "表格标题合并", "file_path": None, "file_name": None, "description": ""},
        "step6_picture_recognition": {"step_name": "图片识别", "file_path": None, "file_name": None, "description": ""}
    }
    
    meta = {
        "document_name": None,
        "task_id": task_id,
        "agent_user_id": agent_user_id,
        "output_directory": output_dir,
        "input_file_path": input_file_path
    }
    
    log = []
    print("u"*40)
    
    try:
        report_progress("init", 5, "初始化任务")
        
        _assert_file_exists(file_path, "DOCX文件")
        log.append(f"输入文件: {file_path}")
        log.append(f"输出目录: {output_dir}")
        
        # Step 1: 标题识别
        report_progress("step1", 15, "执行标题识别...")
        log.append("Step 1: 标题识别")
        text, json_file_name, title_json_path = mod_title_rec.main(file_path, output_dir=output_dir)
        if text is None or not json_file_name or not title_json_path:
            raise RuntimeError("Step 1 标题识别失败")
        file_outputs["step1_title_recognition"]["file_path"] = _abspath(title_json_path)
        file_outputs["step1_title_recognition"]["file_name"] = os.path.basename(title_json_path)
        meta["document_name"] = json_file_name
        log.append(f"✓ Step 1 完成: {title_json_path}")
        
        # Step 2: 标题定位与切块
        report_progress("step2", 30, "执行标题定位与切块...")
        log.append("Step 2: 标题定位与切块")
        blocks_json_path = mod_pos.main(text, title_json_path, output_dir=output_dir)
        if not blocks_json_path:
            raise RuntimeError("Step 2 标题定位失败")
        file_outputs["step2_title_position_blocks"]["file_path"] = _abspath(blocks_json_path)
        file_outputs["step2_title_position_blocks"]["file_name"] = os.path.basename(blocks_json_path)
        log.append(f"✓ Step 2 完成: {blocks_json_path}")
        
        # Step 3: 空块合并
        report_progress("step3", 45, "执行空块合并...")
        log.append("Step 3: 空块合并")
        blocks_merge_json_path = mod_clear.main(
            json_file_name=json_file_name, 
            input_blocks_path=blocks_json_path, 
            output_dir=output_dir
        )
        blocks_for_merge = file_outputs["step2_title_position_blocks"]["file_path"]
        if blocks_merge_json_path:
            file_outputs["step3_blocks_merge"]["file_path"] = _abspath(blocks_merge_json_path)
            file_outputs["step3_blocks_merge"]["file_name"] = os.path.basename(blocks_merge_json_path)
            if use_merged_blocks_for_merge and blocks_merge_json_path:
                wrapped_path = _wrap_blocks_if_needed(blocks_merge_json_path, json_file_name, output_dir)
                file_outputs["step3_blocks_merge_wrapped"]["file_path"] = wrapped_path
                file_outputs["step3_blocks_merge_wrapped"]["file_name"] = os.path.basename(wrapped_path)
                blocks_for_merge = wrapped_path
        log.append(f"✓ Step 3 完成: {blocks_merge_json_path}")
        
        # Step 4: 表格识别
        report_progress("step4", 60, "执行表格识别...")
        log.append("Step 4: 表格识别")
        tables_json_path = mod_table.main(
            text, json_file_name, output_dir=output_dir, 
            input_file_path=input_file_path, 
            agent_user_id=agent_user_id, task_id=task_id
        )
        if not tables_json_path:
            raise RuntimeError("Step 4 表格识别失败")
        file_outputs["step4_table_recognition"]["file_path"] = _abspath(tables_json_path)
        file_outputs["step4_table_recognition"]["file_name"] = os.path.basename(tables_json_path)
        log.append(f"✓ Step 4 完成: {tables_json_path}")
        
        # Step 5: 表格标题合并
        report_progress("step5", 75, "执行表格标题合并...")
        log.append("Step 5: 表格标题合并")
        tables_with_heading_json_path = mod_merge.main(
            json_file_name, tables_json_path, 
            blocks_json_path=blocks_for_merge, 
            output_dir=output_dir
        )
        if not tables_with_heading_json_path:
            raise RuntimeError("Step 5 表格标题合并失败")
        file_outputs["step5_tables_with_heading"]["file_path"] = _abspath(tables_with_heading_json_path)
        file_outputs["step5_tables_with_heading"]["file_name"] = os.path.basename(tables_with_heading_json_path)
        log.append(f"✓ Step 5 完成: {tables_with_heading_json_path}")
        
        # Step 6: 图片识别
        report_progress("step6", 90, "执行图片识别...")
        if run_picture:
            log.append("Step 6: 图片识别")
            proc = EnhancedImageProcessor(input_file_path, agent_user_id, task_id)
            results = proc.process_text_with_images(text)
            picture_json_path = proc.save_results(results, output_file=f"{json_file_name}_picture.json", output_dir=output_dir)
            file_outputs["step6_picture_recognition"]["file_path"] = _abspath(picture_json_path)
            file_outputs["step6_picture_recognition"]["file_name"] = os.path.basename(picture_json_path)
            log.append(f"✓ Step 6 完成: {picture_json_path}")
        else:
            log.append("Step 6: 跳过图片识别")
        
        report_progress("finished", 100, "所有步骤完成")
        log.append("✅ 流水线执行完成")
        
        return {
            "ok": True, "status": 1, "message": "处理成功", 
            "file_outputs": file_outputs, "meta": meta, "log": log, 
            "config": {"output_directory": output_dir}
        }
        
    except Exception as e:
        log.append(f"❌ 错误: {type(e).__name__}: {e}")
        file_outputs["meta"] = meta
        file_outputs["log"] = log + [traceback.format_exc()]
        file_outputs["config"] = {"output_directory": output_dir}
        return {
            "ok": False, "status": 0, "message": f"{type(e).__name__}: {e}", 
            "file_outputs": file_outputs, "meta": meta, "log": log,
            "config": {"output_directory": output_dir}
        }

# ============== FastAPI 接口 ==============
app = FastAPI(title="Doc Pipeline API", version="1.8.0", docs_url="/docs")

class PipelineRequest(BaseModel):
    file_name: str = Field(..., description="文件名称 (例如 test.docx)", example="证书文档.docx")
    task_id: str = Field(..., description="任务ID")
    agentUserId: int = Field(..., description="代理用户ID")
    output_file_path: str = Field(default=DEFAULT_OUTPUT_FILE_PATH, description="结果输出目录")
    input_file_path: str = Field(default=DEFAULT_INPUT_FILE_PATH, description="文件所在的根目录")

class RunResponse(BaseModel):
    ok: bool
    message: str
    query_id: str
    status_url: str

class StatusResponse(BaseModel):
    ok: bool
    status: str
    percent: int
    message: str
    result: Optional[Dict[str, Any]] = None

# ============== 后台任务包装器 ==============
def background_process_wrapper(req_data: PipelineRequest, unique_key: str):
    GLOBAL_TASK_STORE[unique_key] = {
        "status": "running", "percent": 0, "current_step": "init",
        "message": "任务已启动", "result": None
    }

    def update_store(step_key, percent, desc):
        if unique_key in GLOBAL_TASK_STORE:
            GLOBAL_TASK_STORE[unique_key]["percent"] = percent
            GLOBAL_TASK_STORE[unique_key]["current_step"] = step_key
            GLOBAL_TASK_STORE[unique_key]["message"] = desc

    try:
        full_file_path = os.path.join(req_data.input_file_path, str(req_data.task_id), req_data.file_name)
        print(f"Processing file: {full_file_path}")
        
        final_result = run_pipeline_sync(
            file_path=full_file_path,
            task_id=req_data.task_id,
            agent_user_id=req_data.agentUserId,
            output_file_path=req_data.output_file_path,
            input_file_path=req_data.input_file_path,
            run_picture=DEFAULT_RUN_PICTURE,
            use_merged_blocks_for_merge=DEFAULT_USE_MERGED_FOR_MERGE,
            progress_callback=update_store
        )

        status_str = "success" if final_result["status"] == 1 else "failed"
        GLOBAL_TASK_STORE[unique_key].update({
            "status": status_str, "percent": 100, "current_step": "finished",
            "message": final_result["message"], "result": final_result
        })

    except Exception as e:
        traceback.print_exc()
        GLOBAL_TASK_STORE[unique_key].update({
            "status": "failed", "percent": 100, 
            "message": f"系统异常: {str(e)}", "result": None
        })

@app.post("/pipeline/run", response_model=RunResponse)
async def run_pipeline(req: PipelineRequest, background_tasks: BackgroundTasks):
    unique_key = f"{req.agentUserId}_{req.task_id}"
    
    if unique_key in GLOBAL_TASK_STORE and GLOBAL_TASK_STORE[unique_key]["status"] == "running":
        return {
            "ok": True, "message": "任务已在运行中", "query_id": unique_key,
            "status_url": f"/pipeline/status?query_id={unique_key}"
        }
    
    background_tasks.add_task(background_process_wrapper, req, unique_key)
    return {
        "ok": True, "message": "任务已接收，正在后台处理", "query_id": unique_key,
        "status_url": f"/pipeline/status?query_id={unique_key}"
    }

@app.post("/pipeline/run_check", response_model=RunResponse)
async def run_pipeline_check(req: PipelineRequest, background_tasks: BackgroundTasks):
    """
    智能接口：优先检查缓存，有缓存直接返回，无缓存才运行
    """
    unique_key = f"{req.agentUserId}_{req.task_id}"
    
    cached_result = check_cache_result(req)
    if cached_result:
        GLOBAL_TASK_STORE[unique_key] = {
            "status": "success", "percent": 100, "current_step": "finished",
            "message": "文件已存在，跳过处理 (Cached)", "result": cached_result
        }
        return {
            "ok": True, "message": "检测到文件已存在，无需处理", 
            "query_id": unique_key,
            "status_url": f"/pipeline/status?query_id={unique_key}"
        }

    if unique_key in GLOBAL_TASK_STORE and GLOBAL_TASK_STORE[unique_key]["status"] == "running":
        return {
            "ok": True, "message": "任务已在运行中", "query_id": unique_key,
            "status_url": f"/pipeline/status?query_id={unique_key}"
        }

    background_tasks.add_task(background_process_wrapper, req, unique_key)
    return {
        "ok": True, "message": "未检测到结果，任务已启动后台处理", 
        "query_id": unique_key,
        "status_url": f"/pipeline/status?query_id={unique_key}"
    }

@app.get("/pipeline/status", response_model=StatusResponse)
async def get_pipeline_status(query_id: str = Query(..., description="任务的唯一ID")):
    task_info = GLOBAL_TASK_STORE.get(query_id)
    if not task_info:
        return {"ok": False, "status": "not_found", "percent": 0, "message": "任务不存在", "result": None}
    return {
        "ok": True, "status": task_info["status"], "percent": task_info["percent"],
        "message": task_info["message"], "result": task_info["result"]
    }

class StatisticsRequest(BaseModel):
    file_name: str = Field(..., description="文件名称 (例如 test.docx)", example="证书文档.docx")
    task_id: str = Field(..., description="任务ID")
    agentUserId: int = Field(..., description="代理用户ID")
    output_file_path: str = Field(default=DEFAULT_OUTPUT_FILE_PATH, description="结果输出目录")
    input_file_path: str = Field(default=DEFAULT_INPUT_FILE_PATH, description="文件所在的根目录")

class StatisticsResponse(BaseModel):
    ok: bool
    message: str
    statistics: Optional[Dict[str, Any]] = None

def get_document_statistics(file_path: str, task_id: str, agent_user_id: int, output_file_path: str):
    """
    获取文档统计信息，包括文本块、表格、图片数量，以及文件大小、上传日期、总页数等
    """
    try:
        # 获取文件基本信息
        file_name = os.path.basename(file_path)
        file_name_without_ext = os.path.splitext(file_name)[0]
        
        # 构建输出目录路径
        output_dir = os.path.join(output_file_path, str(agent_user_id), task_id)
        
        # 初始化统计信息
        statistics = {
            "file_name": file_name,
            "file_path": file_path,
            "text_blocks_count": 0,
            "tables_count": 0,
            "images_count": 0,
            "total_pages": 0,
            "file_size": 0,
            "upload_date": "",
            "text_recognition_rate": "暂未实现",
            "structure_restoration_degree": "暂未实现",
            "anomaly_items": "暂未实现"
        }
        
        # 获取文件大小和上传日期
        if os.path.exists(file_path):
            file_stat = os.stat(file_path)
            statistics["file_size"] = file_stat.st_size
            # 转换为KB
            statistics["file_size_kb"] = round(file_stat.st_size / 1024, 2)
            # 获取文件修改日期作为上传日期
            statistics["upload_date"] = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(file_stat.st_mtime))
        
        # 读取文本块信息
        blocks_file_path = os.path.join(output_dir, f"{file_name_without_ext}_blocks.json")
        if os.path.exists(blocks_file_path):
            with open(blocks_file_path, 'r', encoding='utf-8') as f:
                blocks_data = json.load(f)
                if "total_blocks" in blocks_data:
                    statistics["text_blocks_count"] = blocks_data["total_blocks"]
                elif "blocks" in blocks_data:
                    statistics["text_blocks_count"] = len(blocks_data["blocks"])
        
        # 读取表格信息
        tables_file_path = os.path.join(output_dir, f"{file_name_without_ext}_tables_with_heading.json")
        if os.path.exists(tables_file_path):
            with open(tables_file_path, 'r', encoding='utf-8') as f:
                tables_data = json.load(f)
                if "tables" in tables_data:
                    statistics["tables_count"] = len(tables_data["tables"])
        
        # 读取图片信息
        picture_file_path = os.path.join(output_dir, f"{file_name_without_ext}_picture.json")
        if os.path.exists(picture_file_path):
            with open(picture_file_path, 'r', encoding='utf-8') as f:
                picture_data = json.load(f)
                if "total_images" in picture_data:
                    statistics["images_count"] = picture_data["total_images"]
                elif "results" in picture_data:
                    statistics["images_count"] = len(picture_data["results"])
        
        # 尝试从文本块信息中获取页数信息
        if os.path.exists(blocks_file_path):
            with open(blocks_file_path, 'r', encoding='utf-8') as f:
                blocks_data = json.load(f)
                if "blocks" in blocks_data and blocks_data["blocks"]:
                    # 从最后一个block获取最大行号作为总页数
                    max_line = 0
                    for block in blocks_data["blocks"]:
                        if "line_end" in block and block["line_end"] > max_line:
                            max_line = block["line_end"]
                    # 这里假设每页大约有40行，这是一个粗略估计
                    statistics["total_pages"] = max(1, round(max_line / 40))
        
        return {"ok": True, "message": "统计信息获取成功", "statistics": statistics}
    
    except Exception as e:
        return {"ok": False, "message": f"获取统计信息失败: {str(e)}", "statistics": None}

@app.post("/pipeline/statistics", response_model=StatisticsResponse)
async def get_statistics(req: StatisticsRequest):
    """
    获取文档统计信息接口
    """
    full_file_path = os.path.join(req.input_file_path, str(req.task_id), req.file_name)
    
    if not os.path.exists(full_file_path):
        return {"ok": False, "message": f"文件不存在: {full_file_path}", "statistics": None}
    
    result = get_document_statistics(
        file_path=full_file_path,
        task_id=req.task_id,
        agent_user_id=req.agentUserId,
        output_file_path=req.output_file_path
    )
    
    return result

if __name__ == "__main__":
    if RUN_HTTP_SERVER:
        import uvicorn
        module_name = os.path.splitext(os.path.basename(__file__))[0]
        print(f"启动服务: {SERVER_HOST}:{SERVER_PORT}")
        uvicorn.run(f"{module_name}:app", host=SERVER_HOST, port=SERVER_PORT, workers=SERVER_WORKERS)
