# LexMind API Testing with Postman

This directory contains comprehensive Postman collections and environments for testing the LexMind API.

## Files

- `LexMind_API_Collection.json` - Main collection with all API endpoints
- `LexMind_Environment_Local.json` - Local development environment
- `test-data-setup.json` - Collection for setting up test data

## Setup Instructions

### 1. Import Collection & Environment

1. Open Postman
2. Click **Import** 
3. Drag and drop `LexMind_API_Collection.json`
4. Import `LexMind_Environment_Local.json` as an environment
5. Select the **LexMind - Local Development** environment

### 2. Start Your API Server

Make sure your LexMind API is running:

```bash
cd apps/api
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 3. Authentication Setup

The collection uses automatic authentication. Just run:

1. **🔐 Authentication** → **Login (Admin)** 
2. The access token will be automatically saved for other requests

## Test Categories

### 🔐 Authentication
- Login with different user roles (admin, analyst, viewer)
- Get current user info
- Test invalid credentials
- Token validation

### 📤 Data Ingestion  
- Ingest regulations and documents
- Test PDF upload (requires sample PDFs)
- Validate input formats

### 🔍 Search & Retrieval
- Hybrid search (FTS + Vector)
- Pagination testing
- Query performance validation

### 📄 Document Management
- List documents with pagination
- Read document content  
- Update metadata
- Get recent documents

### 🤖 AI Analysis
- AI explanation generation
- Fix-it recommendations
- Test with different content types

### 📊 Coverage & Mappings
- Create regulation-document mappings
- View coverage overview
- Get detailed coverage info

### ⚡ Health & System
- Basic health checks
- Full system health (API + DB + LLM)
- Performance monitoring

### 🛡️ Security Tests
- Rate limiting validation
- Unauthorized access attempts
- Content-type validation
- Payload size limits
- Security headers verification

### 🚀 Load Testing
- Concurrent request handling
- Performance under load
- Response time validation

## Running Tests

### Quick Start
1. Run **🔐 Authentication** → **Login (Admin)**
2. Run any other request - auth is automatic!

### Full Test Suite
Use Postman's **Collection Runner**:
1. Select the collection
2. Choose environment 
3. Click **Run**
4. Review test results

### Manual Testing Workflow

**Basic Flow:**
```
1. Health Check → 2. Login → 3. Ingest Data → 4. Search → 5. AI Analysis
```

**Security Testing:**
```  
1. Rate Limit Test → 2. Auth Test → 3. Invalid Requests → 4. Payload Tests
```

## Test Data

### Sample Regulation
```json
{
  "source": "GDPR",
  "title": "General Data Protection Regulation", 
  "section": "Article 32",
  "text": "The controller and processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk."
}
```

### Sample Document 
```json
{
  "path": "data-security-policy.md",
  "content": "Our organization implements multi-layered security including encryption, access controls, regular audits, and staff training to protect personal data.",
  "chunk_idx": 0
}
```

## Performance Benchmarks

**Expected Response Times:**
- Health Check: < 50ms
- Authentication: < 200ms  
- Search Query: < 1000ms
- AI Analysis: < 5000ms (depends on LLM)

**Rate Limits:**
- 100 requests/minute per IP
- 1000 requests/hour per IP

## Troubleshooting

### Common Issues

**❌ 401 Unauthorized**
- Run the login request first
- Check if token is set in collection variables

**❌ 503 Service Unavailable** 
- Check if API server is running
- Verify database connection
- Ensure Ollama is running for AI endpoints

**❌ 429 Too Many Requests**
- You've hit rate limits
- Wait 60 seconds or restart API server

**❌ Connection Refused**
- Verify API is running on http://localhost:8000
- Check firewall/proxy settings

### Debug Tips

1. **Enable Postman Console** - View → Show Postman Console
2. **Check Response Headers** - Look for rate limit info
3. **Inspect Network Timing** - Check for slow queries  
4. **Review Server Logs** - Check API console output

## Advanced Testing

### Newman CLI Testing
```bash
# Install Newman
npm install -g newman

# Run collection
newman run LexMind_API_Collection.json -e LexMind_Environment_Local.json

# Generate HTML report
newman run LexMind_API_Collection.json -e LexMind_Environment_Local.json --reporters html
```

### CI/CD Integration
The collection can be integrated into CI/CD pipelines using Newman for automated API testing.

## Support

For issues with the API or test collection, check:
1. API server logs
2. Database connectivity  
3. Ollama service status
4. Environment variable configuration