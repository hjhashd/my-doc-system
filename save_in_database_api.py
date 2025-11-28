#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
将 import_table_cells.py 封装为 FastAPI 接口
功能：读取 tables_with_heading.json 并导入到 MySQL
"""

import os
import json
import traceback
from typing import Dict, Any
from fastapi import FastAPI
from pydantic import BaseModel, Field
from fastapi.concurrency import run_in_threadpool

# ===== 显式常量定义（按需修改）=====
# MySQL 配置
MYSQL_HOST: str = "localhost"
MYSQL_USER: str = "root"
MYSQL_PASSWORD: str = "xinan@2024"
DB_NAME: str = "document_extraction"

# 服务配置
RUN_HTTP_SERVER: bool = True  # True = HTTP服务；False = 本地测试
SERVER_HOST: str = "0.0.0.0"
SERVER_PORT: int = 8006  # 避免与第一个服务冲突
SERVER_WORKERS: int = 1

# ===== 导入源文件（保持零改动）=====
import table_save_in_database as mod_import


# ============== 核心流程 ==============
def import_to_mysql_sync(json_file_path: str) -> Dict[str, Any]:
    """
    执行 JSON 导入 MySQL 流程。
    返回结构包含 status=1/0。
    """
    result = {
        "ok": False,
        "status": 0,
        "message": "",
        "imported_count": 0,
        "json_file_path": json_file_path,
        "log": []
    }

    try:
        # 检查文件存在性
        if not os.path.isfile(json_file_path):
            raise FileNotFoundError(f"JSON 文件不存在: {json_file_path}")

        result["log"].append(f"开始导入 JSON: {json_file_path}")

        # 确保数据库存在
        result["log"].append(f"确保数据库存在: {DB_NAME}")
        mod_import.ensure_database(DB_NAME)

        # 连接数据库
        result["log"].append("连接 MySQL...")
        conn = mod_import.connect_mysql(DB_NAME)

        try:
            # 确保表存在
            result["log"].append("确保表结构存在...")
            mod_import.ensure_table(conn)

            # 导入数据
            result["log"].append("开始导入数据...")
            total = mod_import.import_json(conn, json_file_path)

            result["ok"] = True
            result["status"] = 1
            result["message"] = f"成功导入 {total} 条单元格记录"
            result["imported_count"] = total
            result["log"].append(f"导入完成: {total} cells")

        finally:
            conn.close()
            result["log"].append("数据库连接已关闭")

        return result

    except Exception as e:
        result["message"] = f"{type(e).__name__}: {e}"
        result["log"].append("异常触发，导入失败")
        result["log"].append(traceback.format_exc())
        return result


# ============== FastAPI 接口 ==============
app = FastAPI(title="Table Cells Import API", version="1.0.0", docs_url="/docs")


class ImportRequest(BaseModel):
    json_file_path: str = Field(..., description="tables_with_heading.json 文件的绝对路径")


class ImportResponse(BaseModel):
    ok: bool
    status: int  # 1 成功 / 0 失败
    message: str
    imported_count: int
    json_file_path: str
    log: list


@app.post("/import/table_cells", response_model=ImportResponse)
async def import_table_cells(req: ImportRequest):
    """
    将 tables_with_heading.json 导入到 MySQL table_cells 表
    """
    result = await run_in_threadpool(import_to_mysql_sync, req.json_file_path)
    return result


@app.get("/health")
async def health_check():
    """健康检查接口"""
    return {"status": "ok", "service": "table_cells_import"}


# ============== 直接运行 ==============
if __name__ == "__main__":
    if RUN_HTTP_SERVER:
        # 启动 HTTP 服务
        import uvicorn

        module_name = os.path.splitext(os.path.basename(__file__))[0]
        import_str = f"{module_name}:app"
        uvicorn.run(
            import_str,
            host=SERVER_HOST,
            port=SERVER_PORT,
            workers=SERVER_WORKERS,
            log_level="info",
        )
    else:
        # 本地测试运行
        DEMO_JSON_PATH = "/data/cwd_cq/out/证书文档_tables_with_heading.json"
        res = import_to_mysql_sync(DEMO_JSON_PATH)
        print("\n=== IMPORT STATUS:", res.get("status", 0), "===")
        print(json.dumps(res, ensure_ascii=False, indent=2))