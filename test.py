import os, json, traceback
from typing import Optional, Dict, Any, List, Callable
from fastapi import FastAPI, BackgroundTasks, Query
from pydantic import BaseModel, Field

# ===== 显式常量定义 =====
DEFAULT_OUTPUT_FILE_PATH: str = "/data/cwd_cq/out"
DEFAULT_INPUT_FILE_PATH: str = "/home/xzh/ocr_flie/pdf_output"
DEFAULT_RUN_PICTURE: bool = True
DEFAULT_USE_MERGED_FOR_MERGE: bool = True

# ===== 导入你的源文件 (保持不变) =====
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
# Key: "{agentUserId}_{taskId}", Value: Dict
GLOBAL_TASK_STORE: Dict[str, Dict[str, Any]] = {}


# ============== 工具函数 (保持不变) ==============
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


# ============== 核心流程 (保持不变，接收完整路径) ==============
def run_pipeline_sync(
        file_path: str,  # 这里的 file_path 是拼接好后的完整路径
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

    # 初始化返回结构
    file_outputs = {
        "step1_title_recognition": {"step_name": "标题识别", "file_path": None, "file_name": None,
                                    "description": "识别文档中的标题及其层级结构"},
        "step2_title_position_blocks": {"step_name": "标题定位与切块", "file_path": None, "file_name": None,
                                        "description": "根据标题位置将文档切分为多个块"},
        "step3_blocks_merge": {"step_name": "空块合并", "file_path": None, "file_name": None,
                               "description": "合并文档中的空白块"},
        "step3_blocks_merge_wrapped": {"step_name": "空块合并（包装版）", "file_path": None, "file_name": None,
                                       "description": "包装后的空块合并结果"},
        "step4_table_recognition": {"step_name": "表格识别", "file_path": None, "file_name": None,
                                    "description": "识别文档中的所有表格及其内容"},
        "step5_tables_with_heading": {"step_name": "表格标题合并", "file_path": None, "file_name": None,
                                      "description": "将标题元数据合并到表格信息中"},
        "step6_picture_recognition": {"step_name": "图片识别", "file_path": None, "file_name": None,
                                      "description": "识别文档中的图片及关键信息"}
    }

    meta = {"document_name": None, "task_id": task_id, "agent_user_id": agent_user_id, "output_directory": output_dir,
            "input_file_path": input_file_path}
    log = []
    print('uuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuuu')
    try:
        report_progress("init", 5, "初始化环境...")

        # 检查输入文件是否存在
        _assert_file_exists(file_path, "输入DOCX文件")
        log.append(f"✅ 处理文件: {file_path}")
        log.append(f"✅ 输出目录: {output_dir}")

        # Step 1
        report_progress("step1", 15, "正在执行: 标题识别...")
        log.append("🔄 Step 1: 标题识别...")
        text, json_file_name, title_json_path = mod_title_rec.main(file_path, output_dir=output_dir)
        if text is None or not json_file_name or not title_json_path: raise RuntimeError("Step 1 失败")
        file_outputs["step1_title_recognition"]["file_path"] = _abspath(title_json_path)
        file_outputs["step1_title_recognition"]["file_name"] = os.path.basename(title_json_path)
        meta["document_name"] = json_file_name

        # Step 2
        report_progress("step2", 30, "正在执行: 标题定位与切块...")
        log.append("🔄 Step 2: 标题定位与切块...")
        blocks_json_path = mod_pos.main(text, title_json_path, output_dir=output_dir)
        if not blocks_json_path: raise RuntimeError("Step 2 失败")
        file_outputs["step2_title_position_blocks"]["file_path"] = _abspath(blocks_json_path)
        file_outputs["step2_title_position_blocks"]["file_name"] = os.path.basename(blocks_json_path)

        # Step 3
        report_progress("step3", 45, "正在执行: 空块合并...")
        log.append("🔄 Step 3: 空块合并...")
        blocks_merge_json_path = mod_clear.main(json_file_name=json_file_name, input_blocks_path=blocks_json_path,
                                                output_dir=output_dir)
        if blocks_merge_json_path:
            file_outputs["step3_blocks_merge"]["file_path"] = _abspath(blocks_merge_json_path)
            file_outputs["step3_blocks_merge"]["file_name"] = os.path.basename(blocks_merge_json_path)

        blocks_for_merge = file_outputs["step2_title_position_blocks"]["file_path"]
        if use_merged_blocks_for_merge and blocks_merge_json_path:
            wrapped_path = _wrap_blocks_if_needed(blocks_merge_json_path, json_file_name, output_dir)
            file_outputs["step3_blocks_merge_wrapped"]["file_path"] = wrapped_path
            file_outputs["step3_blocks_merge_wrapped"]["file_name"] = os.path.basename(wrapped_path)
            blocks_for_merge = wrapped_path

        # Step 4
        report_progress("step4", 60, "正在执行: 表格识别...")
        log.append("🔄 Step 4: 表格识别...")
        tables_json_path = mod_table.main(text, json_file_name=json_file_name, output_dir=output_dir,
                                          input_file_path=input_file_path, agent_user_id=agent_user_id, task_id=task_id)
        if not tables_json_path: raise RuntimeError("Step 4 失败")
        file_outputs["step4_table_recognition"]["file_path"] = _abspath(tables_json_path)
        file_outputs["step4_table_recognition"]["file_name"] = os.path.basename(tables_json_path)

        # Step 5
        report_progress("step5", 75, "正在执行: 表格标题合并...")
        log.append("🔄 Step 5: 表格标题合并...")
        tables_with_heading_json_path = mod_merge.main(json_file_name=json_file_name, tables_json_path=tables_json_path,
                                                       blocks_json_path=blocks_for_merge, output_dir=output_dir)
        if not tables_with_heading_json_path: raise RuntimeError("Step 5 失败")
        file_outputs["step5_tables_with_heading"]["file_path"] = _abspath(tables_with_heading_json_path)
        file_outputs["step5_tables_with_heading"]["file_name"] = os.path.basename(tables_with_heading_json_path)

        # Step 6
        report_progress("step6", 90, "正在执行: 图片识别...")
        if run_picture:
            log.append("🔄 Step 6: 图片识别...")
            proc = EnhancedImageProcessor(input_file_path=input_file_path, agent_user_id=agent_user_id, task_id=task_id)
            results = proc.process_text_with_images(text)
            picture_json_path = proc.save_results(results=results, output_file=f"{json_file_name}_picture.json",
                                                  output_dir=output_dir)
            file_outputs["step6_picture_recognition"]["file_path"] = _abspath(picture_json_path)
            file_outputs["step6_picture_recognition"]["file_name"] = os.path.basename(picture_json_path)
        else:
            log.append("⏭️ Step 6: 图片识别已跳过")

        report_progress("finished", 100, "处理完成")
        log.append("🎉 所有步骤执行完成！")

        return {
            "ok": True, "status": 1, "message": "流水线执行成功",
            "file_outputs": file_outputs, "meta": meta, "log": log,
            "config": {"output_directory": output_dir}
        }

    except Exception as e:
        log.append(f"❌ 异常: {str(e)}")
        return {
            "ok": False, "status": 0, "message": f"{type(e).__name__}: {e}",
            "file_outputs": file_outputs, "meta": meta,
            "log": log + [traceback.format_exc()],
            "config": {"output_directory": output_dir}
        }


# ============== 🔥 FastAPI 接口与模型修改 🔥 ==============
app = FastAPI(title="Doc Pipeline API", version="1.7.0", docs_url="/docs")


class PipelineRequest(BaseModel):
    # 🔥 修改点 1: file_path 移除了，改为 file_name
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


# ============== 后台任务包装器 (处理路径拼接) ==============
def background_process_wrapper(req_data: 'PipelineRequest', unique_key: str):
    """
    在后台线程中运行，负责拼接路径并调用核心逻辑
    """
    # 1. 初始化状态
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

        # 打印一下路径确认 (可选，用于调试)
        print(f"Processing file: {full_file_path}")

        final_result = run_pipeline_sync(
            file_path=full_file_path,  # 传入拼接好的含 task_id 的绝对路径
            task_id=req_data.task_id,
            agent_user_id=req_data.agentUserId,
            output_file_path=req_data.output_file_path,
            input_file_path=req_data.input_file_path, # 传给内部模块的依然是根路径，内部模块通常会自己再拼一次 ID
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
        # 打印堆栈以便调试
        traceback.print_exc()
        GLOBAL_TASK_STORE[unique_key].update({
            "status": "failed", "percent": 100, "message": f"系统异常: {str(e)}", "result": None
        })


# 🔥 提交任务接口
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


# 🔥 轮询接口
@app.get("/pipeline/status", response_model=StatusResponse)
async def get_pipeline_status(query_id: str = Query(..., description="任务的唯一ID")):
    task_info = GLOBAL_TASK_STORE.get(query_id)
    if not task_info:
        return {"ok": False, "status": "not_found", "percent": 0, "message": "任务不存在", "result": None}
    return {
        "ok": True, "status": task_info["status"], "percent": task_info["percent"],
        "message": task_info["message"], "result": task_info["result"]
    }


if __name__ == "__main__":
    if RUN_HTTP_SERVER:
        import uvicorn
        module_name = os.path.splitext(os.path.basename(__file__))[0]
        print(f"启动服务: {SERVER_HOST}:{SERVER_PORT}")
        uvicorn.run(f"{module_name}:app", host=SERVER_HOST, port=SERVER_PORT, workers=SERVER_WORKERS)

