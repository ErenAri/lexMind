import os
import ssl
import time
import logging
from typing import Optional, Sequence, Any, List, Dict
import aiomysql
from aiomysql.cursors import DictCursor
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_pool: Optional[aiomysql.Pool] = None

async def get_pool() -> aiomysql.Pool:
    global _pool
    if _pool is None:
        ca_path = os.getenv("TIDB_CA_CERT")
        ssl_ctx = None
        if ca_path:
            try:
                if os.path.exists(ca_path):
                    ssl_ctx = ssl.create_default_context(cafile=ca_path)
                else:
                    logger.warning(f"TIDB_CA_CERT path not found: {ca_path}. Proceeding without custom CA.")
            except Exception as ssl_exc:
                logger.warning(f"Failed to create SSL context with CA file '{ca_path}': {ssl_exc}. Proceeding without custom CA.")
        host = os.getenv("TIDB_HOST")
        if not host:
            raise RuntimeError("TIDB_HOST is not set. Add it to apps/api/.env")
        _pool = await aiomysql.create_pool(
            host=host,
            port=int(os.getenv("TIDB_PORT", "4000")),
            user=os.getenv("TIDB_USER"),
            password=os.getenv("TIDB_PASSWORD", ""),
            db=os.getenv("TIDB_DATABASE", "lexmind"),
            ssl=ssl_ctx,
            cursorclass=DictCursor,
            minsize=1,
            maxsize=5,
            autocommit=True,
        )
    assert _pool is not None
    return _pool

async def close_pool() -> None:
    global _pool
    if _pool is not None:
        _pool.close()
        await _pool.wait_closed()
        _pool = None

async def execute(sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    start_time = time.time()
    pool = await get_pool()
    
    try:
        async with pool.acquire() as conn:
            async with conn.cursor() as cur:
                await cur.execute(sql, params or [])
                try:
                    rows = await cur.fetchall()
                except Exception:
                    rows = []
                
                # Log slow queries (>100ms)
                execution_time = time.time() - start_time
                if execution_time > 0.1:
                    logger.warning(
                        f"Slow query ({execution_time:.3f}s): {sql[:100]}...",
                        extra={
                            "execution_time": execution_time,
                            "sql": sql,
                            "params": params,
                            "row_count": len(rows) if rows else 0
                        }
                    )
                elif execution_time > 0.05:  # Log medium queries for debugging
                    logger.info(
                        f"Query ({execution_time:.3f}s): {sql[:50]}...",
                        extra={"execution_time": execution_time, "row_count": len(rows) if rows else 0}
                    )
                
                return rows
                
    except Exception as e:
        execution_time = time.time() - start_time
        logger.error(
            f"Query failed ({execution_time:.3f}s): {sql[:100]}... - {e}",
            extra={
                "execution_time": execution_time,
                "sql": sql,
                "params": params,
                "error": str(e)
            }
        )
        raise

# Backward compatibility: older modules import execute_query
async def execute_query(sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    return await execute(sql, params)

# Backward compatibility: some modules expect get_db_pool
async def get_db_pool() -> aiomysql.Pool:
    return await get_pool()