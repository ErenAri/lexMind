# LexMind – Compliance AI Assistant

LexMind is an offline-first, secure compliance assistant built with FastAPI and Next.js. It provides intelligent document analysis, regulatory compliance checking, and conversational AI chat functionality using local LLM inference through Ollama.

## 🚀 Features

- **📄 Document Management**: Upload and manage compliance documents (PDF, DOC, TXT)
- **⚖️ Regulatory Analysis**: Ingest and analyze regulatory texts with full-text search
- **🤖 AI Chat Assistant**: Conversational AI powered by Mistral models via Ollama
- **🔍 Hybrid Search**: Combined full-text and vector search capabilities
- **📊 Compliance Dashboard**: Overview of documents, regulations, and coverage analysis
- **🔐 Secure Authentication**: JWT-based authentication with role-based access
- **🗄️ SQLite Integration**: Local database for offline-first operation

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern async Python web framework
- **SQLite** - Local database with aiomysql compatibility
- **Ollama** - Local LLM inference (Mistral models)
- **PyPDF2** - PDF text extraction
- **JWT** - Authentication and authorization

### Frontend  
- **Next.js 14** - React framework with App Router
- **TypeScript** - Type-safe development
- **Tailwind CSS** - Utility-first CSS framework
- **Lucide Icons** - Modern icon library

## 📁 Project Structure

```
lexmind/
├── apps/
│   ├── api/                    # FastAPI backend
│   │   ├── app/
│   │   │   ├── main_sqlite.py  # Main API server (SQLite version)
│   │   │   ├── auth.py         # Authentication logic
│   │   │   ├── sqlite_deps.py  # Database connection utilities
│   │   │   └── embeddings.py   # Embedding generation (local)
│   │   ├── migrate.py          # Database migration runner
│   │   ├── requirements.txt    # Python dependencies
│   │   └── venv/              # Python virtual environment
│   │
│   └── web/                   # Next.js frontend
│       ├── app/               # App Router pages
│       │   ├── page.tsx       # Dashboard home
│       │   ├── documents/     # Document management
│       │   ├── chat/          # AI chat interface  
│       │   ├── reports/       # Compliance reports
│       │   ├── workflows/     # Workflow automation
│       │   └── settings/      # User settings
│       ├── components/        # Reusable UI components
│       ├── lib/              # Utilities and API clients
│       └── package.json      # Node.js dependencies
│
├── infra/
│   ├── migrations/           # SQL schema migrations
│   └── docker-compose.yml    # TiDB server (optional)
│
├── .env                      # Environment variables
└── README.md                # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js 20+** and **pnpm 9+**
- **Python 3.11+**
- **Ollama** (for AI chat functionality)

### 1. Install Dependencies

```bash
# Install Node.js dependencies
pnpm install

# Install Python dependencies
cd apps/api
python -m venv venv
.\venv\Scripts\activate  # Windows
# source venv/bin/activate  # Linux/Mac
pip install -r requirements.txt
```

### 2. Environment Setup

Create `.env` file in the root directory:

```env
# Database (SQLite)
TIDB_HOST=localhost
TIDB_PORT=3306
TIDB_USER=root
TIDB_PASSWORD=
TIDB_DATABASE=lexmind.db

# Ollama Configuration
OLLAMA_URL=http://127.0.0.1:11434
OLLAMA_MODEL=mistral:7b-instruct

# Frontend
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### 3. Setup Ollama (AI Chat)

```bash
# Install Ollama (visit https://ollama.ai for your OS)

# Pull required models
ollama pull mistral:7b-instruct
ollama pull leximind_mistral:latest  # optional backup model

# Start Ollama service
ollama serve
```

### 4. Database Setup

```bash
cd apps/api
python migrate.py
```

### 5. Start Development Servers

**Terminal 1 - Backend:**
```bash
cd apps/api
.\venv\Scripts\activate
uvicorn app.main_sqlite:app --reload --host 0.0.0.0 --port 8000
```

**Terminal 2 - Frontend:**
```bash
cd apps/web  
pnpm dev
```

**Terminal 3 - Ollama (if not already running):**
```bash
ollama serve
```

### 6. Access Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## 📖 Usage

### First Time Setup

1. **Create Account**: Visit http://localhost:3000 and sign up
2. **Upload Documents**: Navigate to Documents and upload your compliance files
3. **Add Regulations**: Upload regulatory texts for compliance checking
4. **Start Chatting**: Use the AI chat to ask questions about your documents

### AI Chat Examples

- "What are the main GDPR compliance requirements?"
- "What should I do if there's a data breach?"
- "Explain our privacy policy in simple terms"
- "What documents do I need for SOX compliance?"

## 🔧 Configuration

### Environment Variables

#### Backend Configuration
- `TIDB_DATABASE`: SQLite database file path (default: `lexmind.db`)
- `OLLAMA_URL`: Ollama server URL (default: `http://127.0.0.1:11434`)
- `OLLAMA_MODEL`: Primary model name (default: `mistral:7b-instruct`)

#### Frontend Configuration
- `NEXT_PUBLIC_API_URL`: Backend API URL (default: `http://localhost:8000`)

### AI Models

The system supports multiple Ollama models with automatic fallback:

1. **Primary**: `mistral:7b-instruct` (faster, 15s timeout)
2. **Backup**: `leximind_mistral:latest` (20s timeout)

## 📊 API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Document Management  
- `GET /documents` - List all documents
- `POST /ingest/pdf` - Upload PDF document
- `DELETE /documents/{path}` - Delete document

### AI Chat
- `GET /api/v1/chat/conversations` - Get chat conversations
- `POST /api/v1/chat` - Send message to AI
- `GET /api/v1/chat/conversations/{id}/messages` - Get conversation messages

### Search & Analysis
- `POST /query/hybrid` - Hybrid document search
- `POST /ai/explain` - Get AI explanation of content
- `GET /coverage` - Compliance coverage analysis

## 🐛 Troubleshooting

### Common Issues

**1. Chat responses are slow or failing**
- Ensure Ollama is running: `ollama serve`
- Check if models are installed: `ollama list`
- Verify Ollama URL in `.env` file

**2. Database connection errors**
- Check if `lexmind.db` exists in `apps/api/`
- Run migrations: `python migrate.py`
- Verify database path in `.env`

**3. Authentication issues**
- Clear browser localStorage
- Check if user exists in database
- Verify JWT token configuration

**4. File upload failures**
- Check file permissions in upload directory
- Ensure file size is under limits
- Verify PDF files are not corrupted

### Development Tips

- **Reset Database**: Delete `lexmind.db` and run `python migrate.py`
- **Check Logs**: Backend logs appear in terminal running uvicorn
- **API Testing**: Use http://localhost:8000/docs for interactive API testing
- **Model Performance**: Adjust timeout values in `main_sqlite.py` for slower hardware

## 🔄 Recent Updates

### v1.2.0 - Enhanced AI Chat System
- ✅ **Fast AI Responses**: Implemented optimized chat system with 15-20s response times
- ✅ **Mistral Integration**: Full integration with Mistral 7B Instruct model via Ollama
- ✅ **Conversational AI**: AI now provides direct conversational answers instead of document excerpts
- ✅ **Intelligent Fallback**: Multiple model support with automatic fallback system
- ✅ **Document Context**: AI responses use uploaded documents as knowledge base

### v1.1.0 - Enhanced Document Upload
- ✅ **Advanced Upload UI**: Drag-and-drop interface with progress tracking
- ✅ **Metadata Management**: Rich document metadata and tagging system
- ✅ **Bulk Operations**: Multi-document upload and management
- ✅ **File Validation**: Comprehensive file type and size validation

### v1.0.0 - Core Features
- ✅ **Authentication System**: JWT-based user authentication
- ✅ **Document Management**: PDF, DOC, TXT upload and processing  
- ✅ **SQLite Integration**: Local database with migration system
- ✅ **Search Functionality**: Full-text and semantic search
- ✅ **Dashboard Interface**: Compliance overview and analytics

## 🚀 Deployment

### Production Considerations

1. **Environment Variables**: Update `.env` for production URLs and credentials
2. **Database**: Consider PostgreSQL for production instead of SQLite
3. **AI Models**: Ensure sufficient RAM for Ollama models (8GB+ recommended)
4. **File Storage**: Configure proper file upload directories with appropriate permissions
5. **Security**: Enable HTTPS and configure proper CORS settings

### Docker Deployment (Optional)

```bash
# Start TiDB (if using instead of SQLite)
cd infra
docker-compose up -d
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)  
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](Copyright (c) 2025 Eren Arı

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.) file for details.

## 🆘 Support

For support and questions:

1. **Issues**: Create a GitHub issue for bugs and feature requests
2. **Documentation**: Check the `/docs` endpoint for API documentation
3. **Community**: Join discussions in GitHub Discussions

---

**Built for compliance professionals**

> 🔒 **Privacy First**: All data processing happens locally. No external API calls for document analysis.

## 📋 API Testing

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
