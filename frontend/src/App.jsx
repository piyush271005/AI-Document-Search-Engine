import React, { useState, useEffect, useRef } from 'react';

// API Base URL (FastAPI backend)
const API_BASE = 'http://127.0.0.1:8000';

function App() {
  const [activeTab, setActiveTab] = useState('search');
  const [theme, setTheme] = useState('dark');
  
  // Search State
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [answer, setAnswer] = useState('');
  const [sources, setSources] = useState([]);
  const [searchError, setSearchError] = useState('');
  
  // Crawler State
  const [crawlUrl, setCrawlUrl] = useState('https://fastapi.tiangolo.com/tutorial/middleware/');
  const [maxPages, setMaxPages] = useState(15);
  const [limitDomain, setLimitDomain] = useState(true);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState({
    is_crawling: false,
    pages_crawled: 0,
    queue_size: 0,
    total_chunks: 0,
    redis_connected: false,
    crawled_urls: []
  });
  
  // Settings State
  const [llmProvider, setLlmProvider] = useState('mock');
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [ollamaUrl, setOllamaUrl] = useState('http://localhost:11434');
  const [settingsSuccess, setSettingsSuccess] = useState(false);
  
  // Search History
  const [history, setHistory] = useState([]);
  
  // Selected source content modal
  const [activeSourceModal, setActiveSourceModal] = useState(null);

  // Poll intervals for crawl status
  const pollTimer = useRef(null);

  // Load History & Backend settings on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('search_history');
    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
    
    fetchSettings();
    fetchStatus();
    
    // Periodically poll status
    pollTimer.current = setInterval(fetchStatus, 3000);
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  // Sync crawling state
  useEffect(() => {
    setIsCrawling(crawlStatus.is_crawling);
  }, [crawlStatus.is_crawling]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    if (nextTheme === 'light') {
      document.documentElement.classList.add('light-theme');
    } else {
      document.documentElement.classList.remove('light-theme');
    }
  };

  const fetchStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/status`);
      if (res.ok) {
        const data = await res.json();
        setCrawlStatus(data);
      }
    } catch (err) {
      console.error('Error fetching backend status:', err);
    }
  };

  const fetchSettings = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setLlmProvider(data.llm_provider);
        setOllamaUrl(data.ollama_url);
      }
    } catch (err) {
      console.error('Error fetching backend settings:', err);
    }
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSettingsSuccess(false);
    try {
      const res = await fetch(`${API_BASE}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_provider: llmProvider,
          openai_key: openaiKey,
          gemini_key: geminiKey,
          ollama_url: ollamaUrl
        })
      });
      if (res.ok) {
        setSettingsSuccess(true);
        setTimeout(() => setSettingsSuccess(false), 3000);
      }
    } catch (err) {
      alert('Failed to save settings: ' + err.message);
    }
  };

  const handleStartCrawl = async (e) => {
    e.preventDefault();
    setIsCrawling(true);
    try {
      const res = await fetch(`${API_BASE}/api/crawl`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: crawlUrl,
          max_pages: parseInt(maxPages),
          limit_domain: limitDomain
        })
      });
      const data = await res.json();
      if (data.status === 'error') {
        alert(data.message);
      } else {
        fetchStatus();
      }
    } catch (err) {
      alert('Failed to start crawl: ' + err.message);
      setIsCrawling(false);
    }
  };

  const handleResetDB = async () => {
    if (!window.confirm('Are you sure you want to clear all indexed pages and ChromaDB database collections?')) {
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/reset`, { method: 'POST' });
      if (res.ok) {
        alert('Database wiped successfully!');
        fetchStatus();
        setAnswer('');
        setSources([]);
      }
    } catch (err) {
      alert('Reset failed: ' + err.message);
    }
  };

  const handleSearch = async (e) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;
    
    setIsSearching(true);
    setSearchError('');
    setAnswer('');
    setSources([]);
    
    try {
      const res = await fetch(`${API_BASE}/api/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      
      if (res.ok) {
        const data = await res.json();
        setAnswer(data.answer);
        setSources(data.sources);
        
        // Save to History
        const newHistoryItem = {
          query,
          answer: data.answer,
          sources: data.sources,
          timestamp: new Date().toLocaleString()
        };
        const updatedHistory = [newHistoryItem, ...history.filter(h => h.query !== query)].slice(0, 10);
        setHistory(updatedHistory);
        localStorage.setItem('search_history', JSON.stringify(updatedHistory));
      } else {
        const errData = await res.json();
        setSearchError(errData.detail || 'Failed to retrieve answers.');
      }
    } catch (err) {
      setSearchError('Could not contact backend API server. Make sure it is running on port 8000.');
    } finally {
      setIsSearching(false);
    }
  };

  const loadHistoryItem = (item) => {
    setQuery(item.query);
    setAnswer(item.answer);
    setSources(item.sources);
    setActiveTab('search');
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('search_history');
  };

  const handleExportMarkdown = () => {
    let md = `# AI Search Query: ${query}\n\n`;
    md += `${answer}\n\n`;
    md += `## Sources Citations\n`;
    sources.forEach((s, i) => {
      md += `* [Snippet ${i+1}] **${s.title}** - [Link](${s.url})\n`;
    });
    
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `answer-${query.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Quick preset selections
  const fillPreset = (url, pages) => {
    setCrawlUrl(url);
    setMaxPages(pages);
  };

  // Custom text formatter to render pre block codes, paragraphs, and list bullet items nicely
  const formatMarkdown = (text) => {
    if (!text) return '';
    
    const lines = text.split('\n');
    const elements = [];
    let inCodeBlock = false;
    let codeBlockContent = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Match code blocks
      if (line.trim().startsWith('```')) {
        if (inCodeBlock) {
          elements.push(
            <pre key={`code-${i}`}>
              <code>{codeBlockContent.join('\n')}</code>
            </pre>
          );
          codeBlockContent = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeBlockContent.push(line);
        continue;
      }

      // Match headers
      if (line.startsWith('### ')) {
        elements.push(<h3 key={`h3-${i}`} style={{margin: '16px 0 8px 0', color: 'var(--accent-secondary)'}}>{line.slice(4)}</h3>);
      } else if (line.startsWith('**From ')) {
        const cleanFrom = line.replace(/^\*\*/, '').replace(/\*\*$/, '');
        elements.push(<p key={`from-${i}`} style={{fontWeight: '600', color: 'var(--accent-primary)', marginTop: '12px'}}>{cleanFrom}</p>);
      } else if (line.startsWith('> ')) {
        elements.push(<blockquote key={`quote-${i}`} style={{borderLeft: '3px solid var(--accent-secondary)', paddingLeft: '12px', color: 'var(--text-secondary)', fontStyle: 'italic', margin: '8px 0'}}>{line.slice(2)}</blockquote>);
      } else if (line.trim().startsWith('*') || line.trim().startsWith('•') || line.trim().startsWith('-')) {
        const cleanLine = line.trim().replace(/^[\*\-•]\s*/, '');
        elements.push(<li key={`li-${i}`} style={{marginLeft: '20px', listStyleType: 'disc'}}>{cleanLine}</li>);
      } else if (line.trim()) {
        // Simple bold replacements **text** -> <strong>text</strong>
        const parts = [];
        let cursor = 0;
        const boldRegex = /\*\*(.*?)\*\*/g;
        let match;
        
        while ((match = boldRegex.exec(line)) !== null) {
          if (match.index > cursor) {
            parts.push(line.slice(cursor, match.index));
          }
          parts.push(<strong key={`b-${match.index}`}>{match[1]}</strong>);
          cursor = boldRegex.lastIndex;
        }
        if (cursor < line.length) {
          parts.push(line.slice(cursor));
        }
        
        elements.push(<p key={`p-${i}`}>{parts}</p>);
      } else {
        elements.push(<div key={`br-${i}`} style={{height: '10px'}} />);
      }
    }
    
    return elements;
  };

  const progressPercent = crawlStatus.pages_crawled > 0 
    ? Math.min(Math.round((crawlStatus.pages_crawled / maxPages) * 100), 100) 
    : 0;

  return (
    <div className="app-container">
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="logo-section">
          <div className="logo-icon">AG</div>
          <div className="logo-text">AI Doc Search</div>
        </div>
        
        <nav className="nav-links">
          <button 
            className={`nav-btn ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            Search Engine
          </button>
          
          <button 
            className={`nav-btn ${activeTab === 'crawl' ? 'active' : ''}`}
            onClick={() => setActiveTab('crawl')}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 8H17m0 0a5 5 0 11-9.5-2.5"></path></svg>
            Web Crawler {isCrawling && <span className="badge badge-teal" style={{marginLeft: 'auto', fontSize: '0.65rem'}}>Active</span>}
          </button>
          
          <button 
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            LLM Settings
          </button>
        </nav>

        {/* History drawer list */}
        <div style={{marginTop: 'auto', borderTop: '1px solid var(--border-glass)', paddingTop: '20px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px'}}>
            <span style={{fontSize: '0.8rem', fontWeight: 'bold', textTransform: 'uppercase', color: 'var(--text-muted)'}}>History</span>
            {history.length > 0 && <button onClick={clearHistory} style={{background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: '0.75rem'}}>Clear</button>}
          </div>
          
          <div className="history-list">
            {history.map((h, i) => (
              <div key={i} className="history-item" onClick={() => loadHistoryItem(h)}>
                <div className="history-query">{h.query}</div>
                <div className="history-time">{h.timestamp}</div>
              </div>
            ))}
            {history.length === 0 && <p style={{fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic'}}>No past searches</p>}
          </div>
        </div>
      </aside>

      {/* Main Container */}
      <main className="main-content">
        <header className="header-row">
          <div>
            <span style={{fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em'}}>SYSTEM DESIGN & RAG</span>
            <h1 style={{fontSize: '1.8rem', fontWeight: '700', marginTop: '2px'}}>AI Documentation Search Engine</h1>
          </div>
          
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
          </button>
        </header>

        {/* Tab Content 1: Search Tab */}
        {activeTab === 'search' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '28px'}}>
            <div className="glass-card">
              <form onSubmit={handleSearch}>
                <div className="search-wrapper">
                  <input
                    type="text"
                    className="search-input"
                    placeholder="e.g., How do I create a custom middleware in FastAPI?"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    disabled={isSearching}
                  />
                  <button type="submit" className="btn search-btn" disabled={isSearching || crawlStatus.total_chunks === 0}>
                    {isSearching ? 'Analyzing...' : 'Search'}
                  </button>
                </div>
              </form>
              
              {crawlStatus.total_chunks === 0 && (
                <div style={{marginTop: '16px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--warning)', fontSize: '0.9rem', background: 'rgba(245,158,11,0.08)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(245,158,11,0.2)'}}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                  <span>The database is empty. Go to the <strong>Web Crawler</strong> tab to index a documentation site first!</span>
                </div>
              )}
            </div>

            {/* Ingestion & Search Pipeline System Design Visualizer */}
            <div className="glass-card">
              <div className="pipeline-visualizer">
                <div className="visualizer-title">Live System Design Pipeline Visualizer</div>
                
                <svg className="diagram-svg" viewBox="0 0 800 120" fill="none">
                  {/* Lines / Connections */}
                  <path d="M70,60 L140,60" className={`link-line ${isCrawling ? 'active' : ''}`} />
                  <path d="M210,60 L280,60" className={`link-line ${isCrawling ? 'active' : ''}`} />
                  <path d="M350,60 L420,60" className={`link-line ${isCrawling ? 'active' : ''}`} />
                  
                  {/* Query Lines */}
                  <path d="M490,60 L560,60" className={`link-line ${isSearching ? 'active-teal' : ''}`} />
                  <path d="M630,60 L700,60" className={`link-line ${isSearching ? 'active-teal' : ''}`} />
                  
                  {/* Nodes */}
                  {/* Node 1: Crawler */}
                  <circle cx="70" cy="60" r="30" className={`node ${isCrawling ? 'active' : ''}`} />
                  <text x="70" y="60" className="node-text">1. BFS Crawler</text>
                  
                  {/* Node 2: Parser */}
                  <circle cx="175" cy="60" r="30" className={`node ${isCrawling ? 'active' : ''}`} />
                  <text x="175" y="60" className="node-text">2. BeautifulSoup</text>
                  
                  {/* Node 3: Vector Embed */}
                  <circle cx="315" cy="60" r="30" className={`node ${isCrawling ? 'active' : isSearching ? 'active-teal' : ''}`} />
                  <text x="315" y="60" className="node-text">3. Embeddings</text>
                  
                  {/* Node 4: DB (Chroma + BM25) */}
                  <circle cx="455" cy="60" r="35" className={`node ${isCrawling ? 'active' : isSearching ? 'active-teal' : ''}`} />
                  <text x="455" y="52" className="node-text">4. Vector DB</text>
                  <text x="455" y="68" className="node-text" style={{fontSize: '9px', fill: 'var(--accent-secondary)'}}>+ BM25 (RRF)</text>
                  
                  {/* Node 5: LLM pipeline */}
                  <circle cx="595" cy="60" r="30" className={`node ${isSearching ? 'active-teal' : ''}`} />
                  <text x="595" y="60" className="node-text">5. LLM Prompt</text>
                  
                  {/* Node 6: Answer output */}
                  <circle cx="730" cy="60" r="30" className={`node ${isSearching ? 'active-teal' : ''}`} />
                  <text x="730" y="60" className="node-text">6. Citation Answer</text>
                </svg>
                
                <div style={{display: 'flex', gap: '20px', fontSize: '0.8rem', color: 'var(--text-muted)', flexWrap: 'wrap', justifyContent: 'center'}}>
                  <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-primary)'}}></span> Ingestion Flow (Crawl & Index)</span>
                  <span style={{display: 'flex', alignItems: 'center', gap: '6px'}}><span style={{width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-secondary)'}}></span> Retrieval & Generation Flow (Search Query)</span>
                </div>
              </div>
            </div>

            {/* Search error */}
            {searchError && (
              <div className="glass-card" style={{borderColor: 'var(--error)', background: 'rgba(239,68,68,0.06)', color: 'var(--error)', padding: '16px'}}>
                <strong>Retrieval Error: </strong> {searchError}
              </div>
            )}

            {/* Answer Display */}
            {answer && (
              <div className="glass-card">
                <div className="ai-answer-section">
                  <div className="answer-header">
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <span className="badge">AI ANSWER</span>
                      <span className="badge badge-teal" style={{textTransform: 'uppercase'}}>{llmProvider} Engine</span>
                    </div>
                    
                    <button className="theme-toggle" onClick={handleExportMarkdown} style={{padding: '6px 12px'}}>
                      📥 Export as MD
                    </button>
                  </div>
                  
                  <div className="answer-body">
                    {formatMarkdown(answer)}
                  </div>
                  
                  {sources.length > 0 && (
                    <div>
                      <div className="sources-title">Verified Sources ({sources.length})</div>
                      <div className="sources-container">
                        {sources.map((src, index) => (
                          <div 
                            key={index} 
                            className="source-card"
                            onClick={() => setActiveSourceModal(src)}
                          >
                            <div className="source-title">{src.title}</div>
                            <div className="source-excerpt">"{src.content}"</div>
                            <div className="source-footer">
                              <span className="source-link" onClick={(e) => e.stopPropagation()}>
                                Snippet {index+1} ↗
                              </span>
                              <div className="score-badge-group">
                                <span className="score-badge" title="RRF Combined Score">RRF: {src.combined_score.toFixed(3)}</span>
                                <span className="score-badge" title="Vector Cosine Similarity">Cos: {src.similarity_score.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab Content 2: Crawl Tab */}
        {activeTab === 'crawl' && (
          <div style={{display: 'flex', flexDirection: 'column', gap: '28px'}}>
            <div className="glass-card">
              <h2 style={{fontSize: '1.25rem', fontWeight: '600', marginBottom: '16px'}}>Ingest Documentation Site</h2>
              
              <form onSubmit={handleStartCrawl}>
                <div className="form-group">
                  <label className="form-label">Documentation URL to Crawl</label>
                  <input
                    type="url"
                    className="form-input"
                    value={crawlUrl}
                    onChange={(e) => setCrawlUrl(e.target.value)}
                    required
                    disabled={isCrawling}
                  />
                </div>
                
                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px'}}>
                  <div className="form-group">
                    <label className="form-label">Max Pages to Crawl</label>
                    <input
                      type="number"
                      className="form-input"
                      value={maxPages}
                      onChange={(e) => setMaxPages(e.target.value)}
                      min="1"
                      max="150"
                      required
                      disabled={isCrawling}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label className="form-label">Domain Constraint</label>
                    <select 
                      className="form-select"
                      value={limitDomain ? 'true' : 'false'}
                      onChange={(e) => setLimitDomain(e.target.value === 'true')}
                      disabled={isCrawling}
                    >
                      <option value="true">Restrict to base domain</option>
                      <option value="false">Allow cross-domain crawls</option>
                    </select>
                  </div>
                </div>

                <div style={{display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px'}}>
                  <button type="submit" className="btn" disabled={isCrawling} style={{flex: '1', minWidth: '180px'}}>
                    {isCrawling ? 'Crawling Site...' : '🚀 Start Crawl & Index'}
                  </button>
                  <button type="button" className="btn btn-secondary" onClick={handleResetDB} disabled={isCrawling}>
                    🗑️ Wipe Database
                  </button>
                </div>
              </form>

              {/* Crawl Presets */}
              <div style={{borderTop: '1px solid var(--border-glass)', paddingTop: '20px'}}>
                <span style={{fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-secondary)'}}>Choose a Quick Documentation Preset:</span>
                <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginTop: '10px'}}>
                  <div className="source-card" onClick={() => fillPreset('https://fastapi.tiangolo.com/tutorial/middleware/', 10)} style={{padding: '12px'}}>
                    <strong>FastAPI Middleware</strong>
                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>fastapi.tiangolo.com</span>
                  </div>
                  <div className="source-card" onClick={() => fillPreset('https://docs.python.org/3/library/sqlite3.html', 15)} style={{padding: '12px'}}>
                    <strong>Python SQLite3 Docs</strong>
                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>docs.python.org</span>
                  </div>
                  <div className="source-card" onClick={() => fillPreset('https://redis.io/docs/latest/develop/connect/clients/', 15)} style={{padding: '12px'}}>
                    <strong>Redis Clients Docs</strong>
                    <span style={{fontSize: '0.8rem', color: 'var(--text-muted)'}}>redis.io</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Ingestion status card */}
            <div className="glass-card">
              <h2 style={{fontSize: '1.25rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px'}}>
                Crawl Progress & Database Status
                {isCrawling && <span className="badge">Processing Ingestion</span>}
              </h2>
              
              <div className="progress-grid">
                <div className="stat-item">
                  <span className="stat-label">Crawl status</span>
                  <span className="stat-value" style={{color: isCrawling ? 'var(--accent-secondary)' : 'var(--text-muted)'}}>
                    {isCrawling ? 'Crawling...' : 'Idle'}
                  </span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Pages indexed</span>
                  <span className="stat-value">{crawlStatus.pages_crawled}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">ChromaDB Chunks</span>
                  <span className="stat-value">{crawlStatus.total_chunks}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-label">Redis Status</span>
                  <span className="stat-value" style={{color: crawlStatus.redis_connected ? 'var(--success)' : 'var(--warning)'}}>
                    {crawlStatus.redis_connected ? 'Connected' : 'In-Memory Queue'}
                  </span>
                </div>
              </div>

              {isCrawling && (
                <div>
                  <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', fontSize: '0.9rem'}}>
                    <span>Crawling pages ({crawlStatus.pages_crawled} / {maxPages})</span>
                    <span>{progressPercent}%</span>
                  </div>
                  <div className="progress-bar-container">
                    <div className="progress-bar-fill" style={{width: `${progressPercent}%`}} />
                  </div>
                </div>
              )}

              {/* Indexed URLs log */}
              {crawlStatus.crawled_urls.length > 0 && (
                <div style={{marginTop: '24px'}}>
                  <span style={{fontSize: '0.9rem', fontWeight: '600', color: 'var(--text-primary)'}}>Crawled Pages (BFS Logs):</span>
                  <div style={{maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--border-glass)', borderRadius: '8px', padding: '12px', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px'}}>
                    {crawlStatus.crawled_urls.map((url, i) => (
                      <div key={i} style={{fontSize: '0.8rem', display: 'flex', gap: '8px', alignItems: 'center', fontFamily: 'var(--font-mono)'}}>
                        <span style={{color: 'var(--success)'}}>✔</span>
                        <a href={url} target="_blank" rel="noopener noreferrer" style={{color: 'var(--text-secondary)', textDecoration: 'none'}}>{url}</a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab Content 3: Settings Tab */}
        {activeTab === 'settings' && (
          <div className="glass-card">
            <h2 style={{fontSize: '1.25rem', fontWeight: '600', marginBottom: '16px'}}>RAG Pipeline Configurations</h2>
            
            <form onSubmit={handleSaveSettings}>
              <div className="form-group">
                <label className="form-label">LLM Generation Provider</label>
                <select 
                  className="form-select"
                  value={llmProvider}
                  onChange={(e) => setLlmProvider(e.target.value)}
                >
                  <option value="mock">(Recommended) Rule-based Local Mock (Out-of-the-box)</option>
                  <option value="gemini">Google Gemini API (via HTTP Request)</option>
                  <option value="openai">OpenAI API (GPT-4o-mini)</option>
                  <option value="ollama">Ollama (Local LLM Server)</option>
                </select>
                <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>
                  Select 'Rule-based Local Mock' to run the application instantly without any API keys.
                </span>
              </div>

              {llmProvider === 'openai' && (
                <div className="form-group">
                  <label className="form-label">OpenAI API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="sk-..."
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    required
                  />
                </div>
              )}

              {llmProvider === 'gemini' && (
                <div className="form-group">
                  <label className="form-label">Gemini API Key</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="AIzaSy..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    required
                  />
                </div>
              )}

              {llmProvider === 'ollama' && (
                <div className="form-group">
                  <label className="form-label">Ollama Base URL</label>
                  <input
                    type="url"
                    className="form-input"
                    value={ollamaUrl}
                    onChange={(e) => setOllamaUrl(e.target.value)}
                    required
                  />
                  <span style={{fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px'}}>
                    Make sure Ollama is running and has model 'llama3' pulled (`ollama pull llama3`).
                  </span>
                </div>
              )}

              <button type="submit" className="btn" style={{marginTop: '12px'}}>
                Save Settings
              </button>

              {settingsSuccess && (
                <div style={{marginTop: '16px', color: 'var(--success)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px'}}>
                  <span>✔ Settings updated successfully on backend!</span>
                </div>
              )}
            </form>
          </div>
        )}
      </main>

      {/* Selected Source Content Modal */}
      {activeSourceModal && (
        <div style={{position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyItems: 'center', zIndex: 100, padding: '20px'}} onClick={() => setActiveSourceModal(null)}>
          <div className="glass-card" style={{maxWidth: '600px', margin: 'auto', background: 'var(--bg-secondary)', cursor: 'default'}} onClick={(e) => e.stopPropagation()}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-glass)', paddingBottom: '12px', marginBottom: '16px'}}>
              <div>
                <h3 style={{fontSize: '1.1rem', color: 'var(--text-primary)'}}>{activeSourceModal.title}</h3>
                {activeSourceModal.parent_header && <span style={{fontSize: '0.8rem', color: 'var(--accent-secondary)'}}>{activeSourceModal.parent_header}</span>}
              </div>
              <button onClick={() => setActiveSourceModal(null)} style={{background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.25rem', fontWeight: 'bold'}}>×</button>
            </div>
            
            <p style={{fontSize: '0.95rem', color: 'var(--text-primary)', lineHeight: '1.6', background: 'rgba(0,0,0,0.2)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-glass)', fontStyle: 'italic'}}>
              "{activeSourceModal.content}"
            </p>
            
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px'}}>
              <a href={activeSourceModal.url} target="_blank" rel="noopener noreferrer" className="source-link" style={{fontSize: '0.9rem'}}>
                Open Original Page ↗
              </a>
              <button className="btn btn-secondary" onClick={() => setActiveSourceModal(null)} style={{padding: '6px 16px', fontSize: '0.9rem'}}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
