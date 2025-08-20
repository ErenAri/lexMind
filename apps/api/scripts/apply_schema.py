import asyncio
import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# Ensure API .env is loaded for DB credentials
api_root = (Path(__file__).parent / "..").resolve()
load_dotenv(str((api_root / ".env").resolve()))

# Add apps/api to sys.path to import app.* when running from repo root
sys.path.insert(0, str(api_root))

from app.deps import get_pool  # type: ignore


def _read_schema_sql() -> list[str]:
    schema_path = (Path(__file__).parents[2] / "infra" / "sql" / "schema.sql").resolve()
    text = schema_path.read_text(encoding="utf-8")
    # naive split by ';' safe enough for this schema
    statements = []
    for stmt in text.split(";"):
        s = stmt.strip()
        if not s:
            continue
        # restore semicolon removed by split when executing
        statements.append(s)
    return statements


async def main() -> None:
    # Validate required envs
    required = ["TIDB_HOST", "TIDB_USER", "TIDB_DATABASE"]
    missing = [k for k in required if not os.getenv(k)]
    if missing:
        raise RuntimeError(f"Missing required env vars: {', '.join(missing)} (set them in apps/api/.env)")

    pool = await get_pool()
    statements = _read_schema_sql()
    applied = 0
    async with pool.acquire() as conn:
        async with conn.cursor() as cur:
            for stmt in statements:
                await cur.execute(stmt)
                applied += 1
    print(f"Applied {applied} schema statements.")


if __name__ == "__main__":
    asyncio.run(main())


