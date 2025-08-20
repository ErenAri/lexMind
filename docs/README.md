# Docs

- [architecture.md](./architecture.md) - System architecture and technical overview
- [demo.md](./demo.md) - **Complete demo script for TiDB Hackathon presentation**

## Quick Start for Demo

### 1. Start Services
```bash
# Terminal 1: API
cd apps/api
uvicorn app.main:app --reload --port 8000

# Terminal 2: Web
cd apps/web  
pnpm dev -- -p 3001
```

### 2. Test API Endpoints
- **Ingest Reg**: `POST /ingest/reg` with SEC Rule 10b-5
- **Ingest Doc**: `POST /ingest/doc` with trading policy
- **Hybrid Query**: `POST /query/hybrid` with "insider trading"
- **Create Task**: `POST /action/task` for compliance workflow

### 3. Demo Flow
1. **Introduction** (30s) - Innovation highlights
2. **Data Ingestion** (2m) - Live API calls
3. **Hybrid Search** (2m) - FTS + Vector results
4. **Dashboard** (1m) - Professional UI walkthrough
5. **Workflow** (1m) - Task creation and audit

**Total Demo Time**: 5-7 minutes
