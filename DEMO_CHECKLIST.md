# 🎯 Hackathon Demo Checklist
**Pre-Demo Setup for Winning Performance**

---

## **Environment Setup (15 minutes before demo)**

### **1. System Requirements Check**
```bash
# Verify all dependencies
node --version    # Should be 20+
pnpm --version   # Should be 9+
python --version # Should be 3.11+
docker --version # Should be running
ollama --version # Should have models loaded
```

### **2. Service Startup (in order)**
```bash
# 1. Start TiDB (if using local Docker)
cd infra
docker-compose up -d
# Wait 30 seconds for TiDB to be ready

# 2. Check TiDB connection
docker-compose ps  # All should be "Up"

# 3. Start API server
cd ../apps/api
source venv/bin/activate  # or .\venv\Scripts\activate on Windows
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 &

# 4. Start Web UI
cd ../apps/web
pnpm dev &
```

### **3. Pre-load Ollama Models**
```bash
# Ensure models are downloaded (can take 5-10 minutes)
ollama pull mistral:7b-instruct
ollama list  # Verify model exists
```

### **4. Health Checks**
```bash
# API Health Check
curl http://localhost:8000/health
# Should return: {"status": "healthy", "database": "connected"}

# Web UI Check  
curl http://localhost:3000
# Should return HTML

# Database Check
curl "http://localhost:8000/analytics/realtime/metrics"
# Should return JSON with metrics
```

---

## **Demo Data Verification**

### **1. Check Demo Data**
```bash
# Verify Goldman Sachs demo data exists
python demo/goldman_sachs_scenario.py --check-data
```

### **2. Expected Data Counts**
- **Regulations:** 25+ entries (Dodd-Frank, Basel III, SEC rules)
- **Corporate Documents:** 1000+ entries (policies, procedures)
- **Risk Assessments:** 50+ entries
- **Collaboration Sessions:** Demo session data

### **3. Performance Baseline**
Run a quick performance test:
```bash
python demo/performance_check.py
```

**Expected Results:**
- Vector search: <50ms P95 latency
- Hybrid search: <75ms P95 latency  
- Analytics queries: <500ms P95 latency
- System health: >95%

---

## **Demo Flow Checklist**

### **Phase 1: Real-time Collaboration (30 seconds)**
- [ ] Collaboration session starts successfully
- [ ] Multiple participants shown (2+ users online)
- [ ] Live annotations appear
- [ ] User presence indicators working
- [ ] **Backup:** Screenshots in `/demo/screenshots/collaboration/`

### **Phase 2: AI Compliance Analysis (30 seconds)**
- [ ] Analysis request submitted
- [ ] Sub-second response (<100ms)
- [ ] Compliance score displayed (target: 80%+)
- [ ] Findings and recommendations shown
- [ ] **Backup:** Pre-cached analysis results

### **Phase 3: Performance Demo (30 seconds)**
- [ ] Benchmark suite runs
- [ ] Results table displays properly
- [ ] Key metrics highlighted (P50, P95, QPS)
- [ ] Performance comparison vs baseline
- [ ] **Backup:** Static benchmark results

### **Phase 4: Knowledge Graph (30 seconds)**
- [ ] Graph builds successfully
- [ ] Node/edge counts display
- [ ] Analysis results shown
- [ ] Critical paths identified
- [ ] **Backup:** Pre-built graph JSON

### **Phase 5: Executive Dashboard (30 seconds)**
- [ ] Dashboard loads with real data
- [ ] Mobile view switches correctly  
- [ ] Live metrics updating
- [ ] Heat map renders properly
- [ ] **Backup:** Static dashboard screenshots

---

## **Troubleshooting Guide**

### **Common Issues & Fixes**

**API Won't Start:**
```bash
# Kill existing processes
pkill -f uvicorn
pkill -f "python.*app.main"

# Restart with full logging
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000 --log-level debug
```

**Database Connection Failed:**
```bash
# Check TiDB container
docker-compose ps
docker-compose logs tidb

# Test direct connection
mysql -h 127.0.0.1 -P 4000 -u root lexmind -e "SELECT 1"
```

**Ollama Model Issues:**
```bash
# Check Ollama service
ollama list
ps aux | grep ollama

# Restart Ollama
pkill ollama
ollama serve &
ollama pull mistral:7b-instruct
```

**Demo Script Fails:**
```bash
# Run with debugging
python demo/goldman_sachs_scenario.py --verbose --check-endpoints

# Check API connectivity first
curl -v http://localhost:8000/health
```

---

## **Presentation Setup**

### **Screen Setup**
- **Primary display:** Presentation slides
- **Secondary display:** Terminal for demo commands
- **Mobile device:** Show mobile dashboard

### **Browser Setup**
- **Tab 1:** LexMind web interface (http://localhost:3000)
- **Tab 2:** Mobile dashboard (http://localhost:3000/mobile)
- **Tab 3:** API documentation (http://localhost:8000/docs)
- **Tab 4:** TiDB dashboard (if available)

### **Terminal Setup**
```bash
# Terminal window 1: API logs
tail -f logs/api.log

# Terminal window 2: Demo execution
cd /demo
python goldman_sachs_scenario.py

# Terminal window 3: System monitoring  
watch -n 1 'curl -s http://localhost:8000/analytics/realtime/metrics | jq'
```

---

## **Final Pre-Demo Checklist (5 minutes)**

- [ ] **All services running** (API, Web, TiDB, Ollama)
- [ ] **Health checks passing** (API, database, models)
- [ ] **Demo data loaded** (regulations, documents, users)
- [ ] **Performance baseline met** (<50ms search, >95% uptime)
- [ ] **Presentation slides ready** (local backup available)
- [ ] **Demo script tested** (full end-to-end run)
- [ ] **Backup materials ready** (screenshots, videos, static pages)
- [ ] **Mobile device charged** (for mobile demo)
- [ ] **Network stable** (if using cloud TiDB)
- [ ] **Timer set** (5-minute presentation limit)

---

## **Victory Conditions**

### **Demo Success Metrics**
- ✅ **Real-time collaboration:** 2+ users, live annotations
- ✅ **AI analysis speed:** <100ms compliance analysis  
- ✅ **Performance demo:** <50ms search at 1M documents
- ✅ **Knowledge graph:** 150+ nodes, relationships shown
- ✅ **Executive dashboard:** Mobile responsive, live data

### **Audience Engagement**
- ✅ **"Wow" moment:** Sub-second analysis results
- ✅ **Business relevance:** Goldman Sachs scenario resonates  
- ✅ **Technical depth:** TiFlash OLAP impresses judges
- ✅ **Practical value:** Clear ROI demonstration
- ✅ **Scalability proof:** 10M document performance

### **Judging Criteria Met**
1. **Technical Innovation (25/25):** Advanced TiDB features
2. **Business Impact (25/25):** Clear market need and ROI
3. **Demo Quality (25/25):** Live, impressive, realistic
4. **TiDB Utilization (25/25):** Serverless, TiFlash, multi-region

**🏆 Total Score Target: 100/100**

---

## **Post-Demo Actions**

### **Immediate Follow-up**
- [ ] Share GitHub repository link
- [ ] Provide live demo access (if requested)
- [ ] Exchange contact information with judges
- [ ] Upload presentation materials to hackathon portal

### **Documentation Links**
- **Code Repository:** https://github.com/yourusername/lexmind
- **Live Demo:** http://your-deployed-instance.com
- **Technical Documentation:** `/docs/TECHNICAL_SPEC.md`
- **Business Case:** `/docs/BUSINESS_CASE.md`

**🎯 Ready to Win the TiDB AgentX Hackathon 2025!**