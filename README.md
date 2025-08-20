## LexMind Monorepo

LexMind is a regulation compliance AI assistant for the TiDB AgentX Hackathon 2025. Hybrid retrieval over TiDB Serverless using Full-Text Search and Vector Search.

### Prerequisites
- Node.js 20+
- pnpm 9+
- Python 3.11+

### Setup
1) Install dependencies
```bash
pnpm install
```

2) Configure API environment
```bash
cd apps/api
copy .env.example .env
python -m venv .venv
.\\.venv\\Scripts\\activate
pip install -r requirements.txt
```

3) Configure web environment
```bash
cd ../../apps/web
copy .env.example .env
pnpm dev
```

4) Run API
```bash
cd ../api
.\\.venv\\Scripts\\activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API runs at `http://localhost:8000`, web at `http://localhost:3000`.

### Migrations
SQL files are in `infra/migrations`.
```bash
mysql -h <host> -P <port> -u <user> -p <database> < infra/migrations/001_init.sql
```

### Packages
- apps/api: FastAPI backend with mock endpoints
- apps/web: Next.js 14 dashboard
- packages/shared: Shared TypeScript types
- infra: docker-compose, TiDB env, migrations, seed
- docs: architecture and notes

### Environment
- API: TIDB_HOST, TIDB_PORT, TIDB_USER, TIDB_PASSWORD, TIDB_DATABASE
- Web: NEXT_PUBLIC_API_URL (defaults to `http://localhost:8000`)

### API Testing
Comprehensive Postman collection available in `/postman/` directory.

**Quick Start:**
```bash
cd postman
npm install newman -g
newman run LexMind_API_Collection.json -e LexMind_Environment_Local.json
```

**Test Categories:**
- 🔐 Authentication (JWT tokens, role-based access)
- 📤 Data Ingestion (regulations, documents, PDFs)  
- 🔍 Search & Retrieval (hybrid search, pagination)
- 📄 Document Management (CRUD operations)
- 🤖 AI Analysis (explanations, recommendations)
- 📊 Coverage & Mappings (compliance tracking)
- ⚡ Health & System (monitoring, performance)
- 🛡️ Security Tests (rate limiting, validation)
- 🚀 Load Testing (performance under load)

See `/postman/README.md` for detailed testing instructions.
