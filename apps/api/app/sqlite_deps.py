import os
import sqlite3
import time
import logging
from typing import Optional, Sequence, Any, List, Dict
from dotenv import load_dotenv

logger = logging.getLogger(__name__)

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

_connection: Optional[sqlite3.Connection] = None

def get_connection() -> sqlite3.Connection:
    global _connection
    if _connection is None:
        db_path = os.getenv("TIDB_DATABASE", "lexmind.db")
        if not db_path.endswith('.db'):
            db_path += '.db'
        _connection = sqlite3.connect(db_path, check_same_thread=False)
        _connection.row_factory = sqlite3.Row  # Enable dict-like access
    return _connection

def close_connection() -> None:
    global _connection
    if _connection is not None:
        _connection.close()
        _connection = None

def execute(sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    """Execute SQL and return results as list of dicts"""
    start_time = time.time()
    conn = get_connection()
    
    try:
        cursor = conn.cursor()
        cursor.execute(sql, params or [])
        
        if sql.strip().upper().startswith('SELECT'):
            rows = cursor.fetchall()
            # Convert sqlite3.Row objects to dictionaries
            result = [dict(row) for row in rows]
        else:
            conn.commit()
            result = []
        
        # Log slow queries (>100ms)
        execution_time = time.time() - start_time
        if execution_time > 0.1:
            logger.warning(
                f"Slow query ({execution_time:.3f}s): {sql[:100]}...",
                extra={
                    "execution_time": execution_time,
                    "sql": sql,
                    "params": params,
                    "row_count": len(result) if result else 0
                }
            )
        elif execution_time > 0.05:  # Log medium queries for debugging
            logger.info(
                f"Query ({execution_time:.3f}s): {sql[:50]}...",
                extra={"execution_time": execution_time, "row_count": len(result) if result else 0}
            )
        
        return result
        
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

# Async wrapper to maintain compatibility with existing code
async def execute_async(sql: str, params: Sequence[Any] | None = None) -> List[Dict[str, Any]]:
    """Async wrapper for execute function"""
    return execute(sql, params)