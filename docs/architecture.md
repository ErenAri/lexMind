### Architecture

- API: FastAPI
- DB: TiDB Serverless via MySQL protocol
- Retrieval: Full-Text Search on `reg_texts`, Vector Search on `corp_docs`, merged in application layer
- Frontend: Next.js dashboard
