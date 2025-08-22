import asyncio
import aiomysql
import os
from dotenv import load_dotenv

load_dotenv()

async def check_database():
    try:
        host = os.getenv("TIDB_HOST") or ""
        user = os.getenv("TIDB_USER") or ""
        password = os.getenv("TIDB_PASSWORD", "")
        database = os.getenv("TIDB_DATABASE", "lexmind")
        port = int(os.getenv("TIDB_PORT", "4000"))

        if not host or not user:
            raise ValueError("TIDB_HOST and TIDB_USER must be set in environment/.env")

        conn = await aiomysql.connect(
            host=host,
            port=port,
            user=user,
            password=password,
            db=database
        )
        cursor = await conn.cursor()
        
        print("Checking corp_docs table structure:")
        await cursor.execute("DESCRIBE corp_docs")
        result = await cursor.fetchall()
        for row in result:
            print(f"  {row}")
            
        print("\nChecking if corp_docs table exists:")
        await cursor.execute("SHOW TABLES LIKE 'corp_docs'")
        tables = await cursor.fetchall()
        print(f"  Tables found: {tables}")
        
        await cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    asyncio.run(check_database())