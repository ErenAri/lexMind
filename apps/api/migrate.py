import os, pymysql, glob
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

host = os.getenv("TIDB_HOST")
port = int(os.getenv("TIDB_PORT", "4000"))
user = os.getenv("TIDB_USER")
password = os.getenv("TIDB_PASSWORD", "")
ca = os.getenv("TIDB_CA_CERT")
if ca and not os.path.exists(ca):
    # If CA path is configured but file is missing, fall back to non-SSL
    ca = None
if not host:
    raise RuntimeError("TIDB_HOST is not set in .env")

mig_dir = os.path.join(os.path.dirname(__file__), "..", "..", "infra", "migrations")
sql_files = sorted(glob.glob(os.path.join(mig_dir, "*.sql")))

ssl_params = {"ca": ca} if ca else None
conn = pymysql.connect(
    host=host, port=port, user=user, password=password,
    ssl=ssl_params, autocommit=True
)
try:
    with conn.cursor() as cur:
        for path in sql_files:
            sql = open(path, "r", encoding="utf-8").read()
            for stmt in [s.strip() for s in sql.split(";") if s.strip()]:
                cur.execute(stmt)
finally:
    conn.close()
print("Migrations applied.")