# filename: import_table_cells.py
# requirements: pip install pymysql

import json
import hashlib
from decimal import Decimal
from typing import Any, Dict, Iterable, List, Tuple, Optional

import pymysql
from pymysql.connections import Connection

# ---- MySQL 连接参数 ----
MYSQL_HOST = "localhost"
MYSQL_USER = "root"
MYSQL_PASSWORD = "xinan@2024"
DB_NAME = "document_extraction"

# ---- 建表 DDL（新增 column_role 字段）----
CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS `table_cells` (
  `table_id`    VARCHAR(64)  NOT NULL,
  `title`       VARCHAR(255) NOT NULL,
  `table_time`  VARCHAR(64),
  `unit_name`   VARCHAR(64),
  `file_path`   VARCHAR(1024),
  `row_idx`     INT          NOT NULL,
  `column_idx`  INT          NOT NULL,
  `column_name` VARCHAR(255),
  `column_role` VARCHAR(32),              --  新增：列角色 (item/company/person/value/time/other_text/ignore)
  `data_value`  TEXT,
  `row_key`     JSON,
  `row_fp`      CHAR(32),
  PRIMARY KEY (`table_id`, `row_idx`, `column_idx`),
  KEY `idx_title`       (`title`),
  KEY `idx_row_idx`     (`row_idx`),
  KEY `idx_column_idx`  (`column_idx`),
  KEY `idx_column_role` (`column_role`),  --  新增：列角色索引
  KEY `idx_table_row`   (`table_id`, `row_idx`),
  KEY `idx_table_col`   (`table_id`, `column_idx`),
  KEY `idx_title_row`   (`title`, `row_idx`),
  KEY `idx_title_col`   (`title`, `column_idx`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
"""

#  修改 INSERT_SQL，新增 column_role 字段
INSERT_SQL = """
INSERT INTO `table_cells`
(`table_id`,`title`,`table_time`,`unit_name`,`file_path`,
 `row_idx`,`column_idx`,`column_name`,`column_role`,`data_value`,`row_key`,`row_fp`)
VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
ON DUPLICATE KEY UPDATE
  `title`=VALUES(`title`),
  `table_time`=VALUES(`table_time`),
  `unit_name`=VALUES(`unit_name`),
  `file_path`=VALUES(`file_path`),
  `column_name`=VALUES(`column_name`),
  `column_role`=VALUES(`column_role`),
  `data_value`=VALUES(`data_value`),
  `row_key`=VALUES(`row_key`),
  `row_fp`=VALUES(`row_fp`);
"""


# ----------------- MySQL工具 -----------------
def connect_mysql(db: Optional[str] = None) -> Connection:
    conn = pymysql.connect(
        host=MYSQL_HOST,
        user=MYSQL_USER,
        password=MYSQL_PASSWORD,
        database=db,
        charset="utf8mb4",
        autocommit=False,
    )
    return conn


def ensure_database(db_name: str) -> None:
    conn = connect_mysql(None)
    try:
        with conn.cursor() as cur:
            cur.execute(
                f"CREATE DATABASE IF NOT EXISTS `{db_name}` "
                "DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
            )
        conn.commit()
    finally:
        conn.close()


def ensure_table(conn: Connection) -> None:
    with conn.cursor() as cur:
        cur.execute(CREATE_TABLE_SQL)
    conn.commit()


# ----------------- JSON 解析与入库 -----------------
def to_text(val: Any) -> Optional[str]:
    """
    将 JSON 值统一转为文本（存入 data_value）；None 返回 None（落 NULL）
    """
    if val is None:
        return None
    if isinstance(val, Decimal):
        return format(val, "f")
    if isinstance(val, (int, float)):
        return format(Decimal(str(val)), "f")
    return str(val)


# 处理 heading_meta 的函数（可选，更清晰）
def process_heading_meta(heading_meta, default_title):
    """
    处理 heading_meta 字段，返回最终使用的标题

    Args:
        heading_meta: 可能是 list、str 或 None
        default_title: 默认标题（原始 title）

    Returns:
        str: 最终使用的标题
    """
    if not heading_meta:
        return default_title

    # 如果是列表
    if isinstance(heading_meta, list):
        # 过滤空值并连接
        parts = [str(p).strip() for p in heading_meta if p]
        if parts:
            return " > ".join(parts)
        return default_title

    # 如果是字符串
    if isinstance(heading_meta, str):
        stripped = heading_meta.strip()
        if stripped:
            return stripped
        return default_title

    # 其他类型，使用默认值
    return default_title


def explode_rows(doc: Dict[str, Any]) -> Iterable[Tuple]:
    """
    将输入 JSON 炸平为多行 (values tuple)，顺序与 INSERT_SQL 对应。
    新增功能：优先使用 heading_meta 作为 title
    """
    tables = doc.get("tables", [])
    for t in tables:
        table_id = t.get("table_id")

        # ========== 优先使用 heading_meta ==========
        title = t.get("title")
        heading_meta = t.get("heading_meta", "")

        # 使用辅助函数处理 heading_meta
        effective_title = process_heading_meta(heading_meta, title)

        # # 如果 heading_meta 不为空字符串，优先使用它
        # if heading_meta and heading_meta.strip():
        #     effective_title = heading_meta
        #     print(f"✅ 表 {table_id}: 使用 heading_meta = '{effective_title}'")
        # else:
        #     effective_title = title
        #     print(f"ℹ️ 表 {table_id}: 使用原始 title = '{effective_title}'")
        # # ==========================================

        table_time = t.get("table_time")
        unit_name = t.get("unit_name")
        file_path = t.get("file_path")
        subtables = t.get("subtables", [])

        for st in subtables:
            col_range = st.get("col_range") or [1, 0]
            col_start = int(col_range[0])
            headers = st.get("resolved_headers", []) or []
            data_rows = st.get("data_rows", []) or []

            #  读取列角色信息，并转换 Decimal 为 int
            key_columns_raw = st.get("key_columns", {})
            key_columns = {}
            for role, cols in key_columns_raw.items():
                #  转换列索引从 Decimal 到 int
                key_columns[role] = [int(c) if isinstance(c, Decimal) else c for c in cols]

            #  调试：打印列角色信息
            print("=" * 80)
            print(f"表ID: {table_id}")
            print(f"子表ID: {st.get('subtable_id')}")
            print(f"列头: {headers}")
            print(f"列角色配置: {json.dumps(key_columns, ensure_ascii=False)}")

            #  构建列索引 -> 角色的映射
            col_to_role = {}
            for role, cols in key_columns.items():
                for col_idx in cols:
                    col_to_role[int(col_idx)] = role  # 确保是 int

            print(f"列索引->角色映射: {col_to_role}")

            num_cols = len(headers)

            for r_idx, row in enumerate(data_rows, start=1):
                #  调试：打印前3行数据
                if r_idx <= 3:
                    print(f"\n--- 第{r_idx}行数据 ---")
                    for c_off, cell in enumerate(row):
                        role = col_to_role.get(c_off, "unknown")
                        print(f"  列{c_off} [{role}] {headers[c_off] if c_off < len(headers) else '?'}: {repr(cell)}")

                #  根据列角色构建 row_key
                row_key_obj = {}

                # 遍历每一列，根据列角色收集值
                for c_off in range(len(row)):
                    val = to_text(row[c_off])

                    #  调试：记录空值跳过情况
                    if not val:
                        if r_idx <= 3:
                            role = col_to_role.get(c_off)
                            if role in ["item", "company", "person", "time"]:
                                print(f"  ⚠️ 列{c_off} [{role}] 值为空，跳过")
                        continue

                    # 获取该列的角色
                    role = col_to_role.get(c_off)
                    if not role:
                        continue

                    #  只收集文本类角色
                    if role in ["item", "company", "person", "time"]:
                        if role not in row_key_obj:
                            row_key_obj[role] = val
                            if r_idx <= 3:
                                print(f"   添加到row_key: {role} = {val}")

                #  兜底
                if not row_key_obj:
                    first_text = to_text(row[0]) if row else None
                    row_key_obj = {"item": first_text}

                #  调试：打印最终row_key
                if r_idx <= 3:
                    print(f"  最终row_key: {json.dumps(row_key_obj, ensure_ascii=False)}")

                # 生成JSON字符串和指纹
                row_key_str = json.dumps(row_key_obj, ensure_ascii=False, sort_keys=True)
                row_fp = hashlib.md5(row_key_str.encode("utf-8")).hexdigest()

                # 逐列生成 cell
                for c_off in range(num_cols):
                    column_idx = col_start + c_off
                    column_name = headers[c_off] if c_off < len(headers) else None
                    column_role = col_to_role.get(c_off)

                    cell_val = None
                    if isinstance(row, list) and c_off < len(row):
                        cell_val = row[c_off]
                    data_value = to_text(cell_val)

                    # ========== 使用处理后的 effective_title ==========
                    yield (
                        table_id,
                        effective_title,  # 使用处理后的标题
                        table_time,
                        unit_name,
                        file_path,
                        r_idx,
                        column_idx,
                        column_name,
                        column_role,
                        data_value,
                        row_key_str,
                        row_fp,
                    )

            print("=" * 80)


def import_json(conn: Connection, json_path: str) -> int:
    """
    读取 json_path，解析并批量导入到 table_cells。
    返回导入的单元格数量。
    """
    with open(json_path, "r", encoding="utf-8") as f:
        doc = json.load(f, parse_float=Decimal, parse_int=Decimal)

    rows = list(explode_rows(doc))
    if not rows:
        return 0

    with conn.cursor() as cur:
        cur.executemany(INSERT_SQL, rows)
    conn.commit()
    return len(rows)


# ----------------- main -----------------
def main():
    JSON_FILE = "/data/cwd_cq/out/证书文档_tables_with_heading.json"

    ensure_database(DB_NAME)
    conn = connect_mysql(DB_NAME)
    try:
        ensure_table(conn)
        total = import_json(conn, JSON_FILE)
        print(f"Done. Attempted to insert {total} cells into `table_cells`.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()