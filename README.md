# AI Documentation Search Engine

A production-grade semantic & keyword hybrid search engine for technical documentation websites. The system utilizes BFS crawling, BeautifulSoup parsing, paragraph-aware text chunking, `sentence-transformers` vector embeddings, ChromaDB, BM25 keyword matching, Reciprocal Rank Fusion (RRF), and modular LLM integrations (Gemini, OpenAI, Ollama, and a local Mock provider).

---

## 🏗️ Architecture & Flow

### Ingestion Flow (Crawl & Index)
1. **BFS Web Crawler**: Downloads documentation pages recursively from a base URL up to a configured page count and depth limit.
2. **BeautifulSoup Parser**: Strips HTML tags, navigation bars, headers, and scripts. Organizes content into headers, paragraphs, and lists.
3. **Paragraph-Aware Chunker**: Groups content into coherent text chunks of ~800 characters, preserving sentence boundaries and source titles.
4. **Vector Embedding Service**: Converts text chunks into 384-dimensional dense vectors using a local `sentence-transformers/all-MiniLM-L6-v2` model.
5. **Storage**: Vectors and chunk text/metadata are indexed in a local **ChromaDB** database.
6. **BM25 Index**: The text chunk corpus is indexed into an in-memory `rank-bm25` instance.

### Query Flow (RAG Search)
1. **User Query**: User submits a question.
2. **Dual-Retrieval Path**:
   - **Vector Search**: Fetches Top-15 chunks based on Cosine Similarity.
   - **BM25 Search**: Fetches Top-15 chunks based on keyword matching.
3. **Reciprocal Rank Fusion (RRF)**: Merges results using rank-based reciprocal scores, creating a single hybrid ranking.
4. **LLM Generation**: Top 5 chunks are formatted into a RAG prompt sent to the LLM (Gemini, OpenAI, Ollama, or Mock), which synthesizes the answer with citations.

---

## 🛠️ Tech Stack
* **Backend**: FastAPI, HTTPX, BeautifulSoup4, ChromaDB, Sentence-Transformers, Rank-BM25.
* **Frontend**: React + Vite, Vanilla CSS (Glassmorphic dark-theme, animated pipeline visualizer).
* **Deployment**: Docker, Docker Compose.

---

## 🚀 How to Run Locally

### Prerequisites
* Python 3.9+
* Node.js v18+

### 1. Start the Backend
1. Navigate to the backend folder:
   ```bash
   cd backend
   ```
2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the uvicorn API server:
   ```bash
   python main.py
   ```
The backend API documentation will be available at `http://127.0.0.1:8000/docs`.

### 2. Start the Frontend
1. Navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install Node packages:
   ```bash
   npm install
   ```
3. Run the Vite development server:
   ```bash
   npm run dev
   ```
Open `http://localhost:5173` in your browser.

---

## 🐳 Running with Docker
To orchestrate the FastAPI backend and Nginx frontend containers automatically:
```bash
docker-compose up --build
```
* **Frontend**: `http://localhost:3000`
* **Backend API**: `http://localhost:8000`

---

## 🎓 Systems Design & RAG Interview Questions

### 1. Why BFS instead of DFS for the Crawler?
* **BFS (Breadth-First Search)** downloads pages layer-by-layer starting from the homepage (Homepage -> Level 1 child links -> Level 2 child links).
* Documentation structures are highly hierarchical. Core guides are linked directly from the homepage, while deep API parameters are pages deep. BFS ensures we discover high-importance structural pages first. DFS would crawl deep down a single obscure path before indexing other primary tabs.

### 2. Why ChromaDB?
* ChromaDB is an open-source, lightweight vector database designed specifically for AI-driven semantic search applications.
* It supports persistence out of the box and is extremely easy to embed directly inside a Python environment without needing external cloud instances during development, while still offering robust HNSW indexing.

### 3. What is Reciprocal Rank Fusion (RRF) and why combine BM25 + Vector Search?
* **Vector Search** excels at understanding semantic meaning and synonym matching (e.g. mapping "query a table" to "SELECT * FROM"). However, it can struggle with exact keyword matching, version numbers, or specific configuration variables (e.g. finding exactly `@app.middleware("http")`).
* **BM25** is a highly optimized TF-IDF variation that excels at exact word matching.
* **RRF** blends both searches together. It assigns a score to each document based on its rank in both retrieval lists:
  $$\text{RRF Score} = \sum_{m \in M} \frac{1}{60 + r_m(d)}$$
  This outputs a hybrid ranking that gets the best of both semantic and exact keyword search.
