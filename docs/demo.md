# LexMind Demo Script - TiDB AgentX Hackathon 2025

## Demo Overview
**Duration**: 5-7 minutes  
**Audience**: Hackathon judges and participants  
**Goal**: Showcase hybrid FTS + Vector search over TiDB Serverless

## Pre-Demo Setup
1. **API Running**: `http://localhost:8000` (FastAPI + TiDB)
2. **Web Running**: `http://localhost:3001` (Next.js Dashboard)
3. **Database**: TiDB Serverless with migrations applied
4. **Postman**: Ready with collection imported

---

## Demo Flow

### 1. Introduction (30 seconds)
**"Welcome to LexMind - AI-Powered Compliance Assistant"**
- Built for TiDB AgentX Hackathon 2025
- **Key Innovation**: Hybrid retrieval combining Full-Text Search + Vector Search
- **Tech Stack**: FastAPI + Next.js + TiDB Serverless + Local AI embeddings

### 2. Live Demo - Data Ingestion (2 minutes)

#### Step A: Ingest Regulation
**"Let me show you how we ingest regulatory text"**
- **Endpoint**: `POST /ingest/reg`
- **Payload**:
```json
{
  "source": "SEC",
  "title": "Rule 10b-5", 
  "section": "240.10b-5",
  "text": "It is unlawful to make any untrue statement of a material fact or to omit to state a material fact necessary in order to make the statements made, in the light of the circumstances under which they were made, not misleading."
}
```
- **Expected**: `{"ok": true}` - Stored in `reg_texts` with FTS index

#### Step B: Ingest Company Document  
**"Now let's add a company policy document"**
- **Endpoint**: `POST /ingest/doc`
- **Payload**:
```json
{
  "path": "/policies/trading.md",
  "content": "Employees must not trade on material nonpublic information. All trading activities must be pre-approved by compliance officer. Violations will result in immediate termination.",
  "chunk_idx": 0
}
```
- **Expected**: `{"ok": true}` - Chunked and stored in `corp_docs` with 1536-d vector embeddings

### 3. Hybrid Search Demo (2 minutes)

#### Step C: Hybrid Query
**"Here's where the magic happens - hybrid search combining FTS and Vector"**
- **Endpoint**: `POST /query/hybrid`
- **Payload**:
```json
{
  "query": "insider trading",
  "top_k": 5
}
```

**Explain the Results**:
- **FTS Results**: Regulation text matches from `reg_texts` using LIKE/occurrence scoring
- **Vector Results**: Document chunks from `corp_docs` using cosine similarity
- **Merged Scoring**: Alpha-weighted combination (60% FTS + 40% Vector)
- **Business Value**: Finds both regulatory requirements AND company policy gaps

### 4. Dashboard Walkthrough (1 minute)

#### Step D: UI Demonstration
**"Let me show you the enterprise dashboard"**
- **Splash Screen**: Professional branding with LexMind logo
- **Three-Panel Layout**: Filters | Findings | Details
- **Real-time Data**: Results from hybrid search displayed
- **Action Buttons**: Explain, Fix-it, Mark as resolved

### 5. Compliance Workflow (1 minute)

#### Step E: Task Creation
**"Finally, let's create a compliance task"**
- **Endpoint**: `POST /action/task`
- **Payload**:
```json
{
  "finding_id": 1,
  "system": "jira",
  "status": "open",
  "assignee": "compliance_team",
  "due_date": "2025-02-01"
}
```

**Explain the Workflow**:
- Finding → Task → Audit Log
- Full compliance traceability
- Integration ready for enterprise systems

---

## Technical Highlights to Emphasize

### 1. **TiDB Innovation**
- **FTS**: `FULLTEXT INDEX` on regulation text
- **Vector**: `VECTOR INDEX` with HNSW for 1536-d embeddings
- **Hybrid**: Application-layer result merging and re-ranking

### 2. **Offline-First AI**
- **Local Embeddings**: Deterministic 1536-d vectors (no OpenAI API)
- **Scalable**: Ready for production embedding models
- **Secure**: No external AI service dependencies

### 3. **Enterprise Ready**
- **CORS**: Cross-origin support
- **Connection Pooling**: TiDB connection management
- **Error Handling**: Graceful fallbacks and user feedback

---

## Demo Tips

### **Do's**
- ✅ Show live API responses in Postman
- ✅ Highlight the hybrid search results
- ✅ Emphasize TiDB Serverless integration
- ✅ Demonstrate the professional UI

### **Don'ts**
- ❌ Don't get stuck on technical details
- ❌ Don't show empty results (use mock data)
- ❌ Don't forget to mention the hackathon context

---

## Expected Questions & Answers

### Q: "Why hybrid search?"
**A**: "Regulations need exact text matching (FTS), while company documents need semantic understanding (Vector). Together, they provide comprehensive compliance coverage."

### Q: "How does this scale?"
**A**: "TiDB Serverless handles the database scaling, while our chunking strategy processes documents of any size. The local embedding generator can be replaced with production models."

### Q: "What's the business value?"
**A**: "Automated compliance gap detection, reduced manual review time, and full audit trails for regulatory reporting."

---

## Demo Success Criteria
- ✅ All API endpoints return 200 responses
- ✅ Dashboard displays findings with mock data
- ✅ Search functionality works smoothly
- ✅ Professional UI impresses judges
- ✅ Technical innovation is clear

**Remember**: This is a hackathon demo - focus on the innovation and potential, not production readiness!
