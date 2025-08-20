import os, pymysql
from dotenv import load_dotenv
load_dotenv(".env")

ssl = None
ca = os.getenv("TIDB_CA_CERT")
if ca:
    ssl = {"ca": ca}

conn = pymysql.connect(
    host=os.getenv("TIDB_HOST","127.0.0.1"),
    port=int(os.getenv("TIDB_PORT","4000")),
    user=os.getenv("TIDB_USER","root"),
    password=os.getenv("TIDB_PASSWORD",""),
    autocommit=True,
    ssl=ssl
)
with conn.cursor() as cur:
    cur.execute("CREATE DATABASE IF NOT EXISTS lexmind")
    cur.execute("USE lexmind")
    for t in ("reg_texts","corp_docs"):
        try:
            cur.execute(f"DELETE FROM {t}")
            print(f"cleared {t}")
        except Exception as e:
            print(f"{t}: {e}")
conn.close()
print("done.")
