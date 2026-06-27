import React, { useState, useEffect, useRef } from 'react';
import { 
  TrendingUp, 
  Package, 
  DollarSign, 
  ShieldCheck, 
  MessageSquare, 
  UploadCloud, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  ArrowRight,
  Send,
  User,
  Bot,
  HelpCircle,
  Activity,
  Trash2
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  BarChart, 
  Bar, 
  Cell 
} from 'recharts';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dashboardData, setDashboardData] = useState(null);
  const [auditLogs, setAuditLogs] = useState([]);
  const [chatLog, setChatLog] = useState([
    {
      id: 'welcome',
      role: 'model',
      content: "Hello! I am BizGuardian AI, your secure business advisor concierge. Upload your business data in the **Upload Center**, then let's analyze your performance, charts, risks, and forecasts here!"
    }
  ]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [sessionId, setSessionId] = useState(null);

  const [uploadStatus, setUploadStatus] = useState({
    sales: null,
    inventory: null,
    financials: null
  });

  const chatEndRef = useRef(null);

  // Fetch Dashboard Stats and Audit Logs
  const loadDashboard = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/dashboard');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (e) {
      console.error("Dashboard fetch error:", e);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const res = await fetch('http://127.0.0.1:8000/api/audit-logs');
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data);
      }
    } catch (e) {
      console.error("Audit log fetch error:", e);
    }
  };

  useEffect(() => {
    loadDashboard();
    loadAuditLogs();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatLog, isChatLoading]);

  // Reset database helper
  const handleResetDb = async () => {
    if (window.confirm("Are you sure you want to clear all data in the database?")) {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/reset-db', { method: 'POST' });
        if (res.ok) {
          loadDashboard();
          loadAuditLogs();
          setChatLog([{
            id: 'clear',
            role: 'model',
            content: "Database has been reset. Please upload new CSV files to begin analysis."
          }]);
        }
      } catch (e) {
        console.error("Reset error:", e);
      }
    }
  };

  // Upload datasets
  const handleFileUpload = async (type, file) => {
    if (!file) return;
    setUploadStatus(prev => ({ ...prev, [type]: 'uploading' }));
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/upload/${type}`, {
        method: 'POST',
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        setUploadStatus(prev => ({ ...prev, [type]: 'success' }));
        loadDashboard();
        loadAuditLogs();
      } else {
        const err = await res.json();
        setUploadStatus(prev => ({ ...prev, [type]: `error: ${err.detail}` }));
      }
    } catch (e) {
      setUploadStatus(prev => ({ ...prev, [type]: 'error: Network error' }));
    }
  };

  // Chat message submission
  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!currentMessage.trim() || isChatLoading) return;
    
    const messageText = currentMessage;
    setCurrentMessage('');
    setIsChatLoading(true);
    
    // Add user message
    setChatLog(prev => [...prev, { id: uuidv4(), role: 'user', content: messageText }]);
    
    try {
      const res = await fetch('http://127.0.0.1:8000/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText, session_id: sessionId })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.session_id) setSessionId(data.session_id);
        setChatLog(prev => [...prev, { id: uuidv4(), role: 'model', content: data.response }]);
      } else {
        const err = await res.json();
        setChatLog(prev => [...prev, { id: uuidv4(), role: 'model', content: `⚠️ Error: ${err.detail || 'Could not communicate with agent backend.'}` }]);
      }
    } catch (e) {
      setChatLog(prev => [...prev, { id: uuidv4(), role: 'model', content: "⚠️ Network connection issue. Make sure backend server is running." }]);
    } finally {
      setIsChatLoading(false);
      loadAuditLogs();
    }
  };

  // Simple uuid v4 helper
  const uuidv4 = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  };

  // Render components
  const healthStats = dashboardData?.health || {
    health_score: 100,
    net_profit: 0,
    total_sales: 0,
    total_expenses: 0,
    shortage_count: 0,
    overstock_count: 0,
    deductions: []
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-main)' }}>
      {/* Sidebar Navigation */}
      <aside style={{
        width: '280px',
        borderRight: '1px solid var(--border-glass)',
        padding: '30px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '40px',
        background: 'rgba(10, 15, 30, 0.5)',
        backdropFilter: 'blur(20px)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, var(--secondary), var(--primary))',
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(99, 102, 241, 0.4)'
          }}>
            <ShieldCheck size={24} color="#fff" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.25rem', fontWeight: '800', tracking: 'wide', color: 'var(--text-highlight)' }}>BIZGUARDIAN</h1>
            <span style={{ fontSize: '0.75rem', color: 'var(--secondary)', fontWeight: '600' }}>AI CONCIERGE</span>
          </div>
        </div>

        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <button 
            onClick={() => setActiveTab('dashboard')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '12px 16px', borderRadius: '10px', border: 'none',
              background: activeTab === 'dashboard' ? 'var(--primary-glow)' : 'transparent',
              color: activeTab === 'dashboard' ? 'var(--text-highlight)' : 'var(--text-muted)',
              fontFamily: 'inherit', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
              transition: 'var(--transition-fast)',
              borderLeft: activeTab === 'dashboard' ? '3px solid var(--primary)' : '3px solid transparent'
            }}
          >
            <Activity size={18} /> Dashboard
          </button>
          
          <button 
            onClick={() => setActiveTab('chat')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '12px 16px', borderRadius: '10px', border: 'none',
              background: activeTab === 'chat' ? 'var(--primary-glow)' : 'transparent',
              color: activeTab === 'chat' ? 'var(--text-highlight)' : 'var(--text-muted)',
              fontFamily: 'inherit', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
              transition: 'var(--transition-fast)',
              borderLeft: activeTab === 'chat' ? '3px solid var(--primary)' : '3px solid transparent'
            }}
          >
            <MessageSquare size={18} /> Chat with AI
          </button>

          <button 
            onClick={() => setActiveTab('upload')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '12px 16px', borderRadius: '10px', border: 'none',
              background: activeTab === 'upload' ? 'var(--primary-glow)' : 'transparent',
              color: activeTab === 'upload' ? 'var(--text-highlight)' : 'var(--text-muted)',
              fontFamily: 'inherit', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
              transition: 'var(--transition-fast)',
              borderLeft: activeTab === 'upload' ? '3px solid var(--primary)' : '3px solid transparent'
            }}
          >
            <UploadCloud size={18} /> Upload Center
          </button>

          <button 
            onClick={() => setActiveTab('audit')}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
              padding: '12px 16px', borderRadius: '10px', border: 'none',
              background: activeTab === 'audit' ? 'var(--primary-glow)' : 'transparent',
              color: activeTab === 'audit' ? 'var(--text-highlight)' : 'var(--text-muted)',
              fontFamily: 'inherit', fontWeight: '600', cursor: 'pointer', textAlign: 'left',
              transition: 'var(--transition-fast)',
              borderLeft: activeTab === 'audit' ? '3px solid var(--primary)' : '3px solid transparent'
            }}
          >
            <ShieldCheck size={18} /> Security Logs
          </button>
        </nav>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <button 
            onClick={handleResetDb}
            style={{
              display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center',
              padding: '12px', borderRadius: '10px', border: '1px solid rgba(239, 68, 68, 0.2)',
              background: 'rgba(239, 68, 68, 0.05)', color: '#fca5a5', cursor: 'pointer',
              fontFamily: 'inherit', fontWeight: '500', transition: 'var(--transition-fast)'
            }}
            onMouseOver={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'}
            onMouseOut={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)'}
          >
            <Trash2 size={16} /> Reset Database
          </button>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
            BizGuardian v1.0.0
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, padding: '40px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '30px' }}>
        {/* Top Header */}
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: '0.85rem', textTransform: 'uppercase', tracking: 'wider', color: 'var(--secondary)', fontWeight: '700' }}>
              {activeTab === 'dashboard' && "Performance & Risk Command Center"}
              {activeTab === 'chat' && "AI Business Advisory Agent"}
              {activeTab === 'upload' && "Data File Importer"}
              {activeTab === 'audit' && "Real-Time Guardrail Auditing"}
            </span>
            <h2 style={{ fontSize: '1.8rem', fontWeight: '700', color: 'var(--text-highlight)' }}>
              {activeTab === 'dashboard' && "MSME Command Dashboard"}
              {activeTab === 'chat' && "Strategic Advice Chat"}
              {activeTab === 'upload' && "Upload Center"}
              {activeTab === 'audit' && "Security Logs"}
            </h2>
          </div>
          <button 
            onClick={() => { loadDashboard(); loadAuditLogs(); }} 
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: '8px' }}
          >
            <RefreshCw size={16} /> Sync Data
          </button>
        </header>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
            {/* Quick Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
              {/* Business Health Card */}
              <div className="glass-card glow-indigo" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)',
                  width: '60px', height: '60px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.5rem', fontWeight: '800', color: healthStats.health_score > 70 ? 'var(--success)' : 'var(--warning)'
                }}>
                  {healthStats.health_score}
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>Health Score</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-highlight)' }}>
                    {healthStats.health_score >= 80 ? "Robust" : healthStats.health_score >= 60 ? "Warning" : "Critical"}
                  </div>
                </div>
              </div>

              {/* Revenue Card */}
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)',
                  width: '60px', height: '60px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <DollarSign size={28} color="var(--success)" />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>Total Revenue</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-highlight)' }}>
                    ${healthStats.total_sales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Profit Card */}
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  background: healthStats.net_profit >= 0 ? 'rgba(6, 182, 212, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                  border: healthStats.net_profit >= 0 ? '1px solid rgba(6, 182, 212, 0.2)' : '1px solid rgba(239, 68, 68, 0.2)',
                  width: '60px', height: '60px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <TrendingUp size={28} color={healthStats.net_profit >= 0 ? 'var(--secondary)' : 'var(--danger)'} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>Net cash flow</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: healthStats.net_profit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    ${healthStats.net_profit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>

              {/* Stock Shortages Card */}
              <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div style={{
                  background: healthStats.shortage_count > 0 ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                  border: healthStats.shortage_count > 0 ? '1px solid rgba(245, 158, 11, 0.2)' : '1px solid rgba(16, 185, 129, 0.2)',
                  width: '60px', height: '60px', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Package size={28} color={healthStats.shortage_count > 0 ? 'var(--warning)' : 'var(--success)'} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '500' }}>Shortage Risks</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-highlight)' }}>
                    {healthStats.shortage_count} items low
                  </div>
                </div>
              </div>
            </div>

            {/* Health Analysis Explainer */}
            {healthStats.deductions.length > 0 && (
              <div className="glass-card" style={{ borderLeft: '4px solid var(--warning)', background: 'rgba(245, 158, 11, 0.03)' }}>
                <h4 style={{ fontSize: '1rem', fontWeight: '700', marginBottom: '10px', color: 'var(--text-highlight)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={18} color="var(--warning)" /> Health Score Deductions Breakdown
                </h4>
                <ul style={{ paddingLeft: '20px', fontSize: '0.9rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {healthStats.deductions.map((d, idx) => (
                    <li key={idx}>{d}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Empty State Banner */}
            {!dashboardData || (!dashboardData.charts.sales_timeline.length && !dashboardData.charts.low_stock.length) ? (
              <div className="glass-card glow-cyan" style={{ padding: '60px 40px', textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
                <UploadCloud size={60} color="var(--secondary)" />
                <div>
                  <h3 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--text-highlight)' }}>No MSME Datasets Found</h3>
                  <p style={{ color: 'var(--text-muted)', marginTop: '8px', maxWidth: '500px', margin: '8px auto 0' }}>
                    To initialize the advisor agents and view business analytics, please navigate to the **Upload Center** and upload CSV/Excel files for sales, inventory, and financials.
                  </p>
                </div>
                <button onClick={() => setActiveTab('upload')} className="btn-primary" style={{ marginTop: '10px' }}>
                  Go to Upload Center <ArrowRight size={18} />
                </button>
              </div>
            ) : (
              /* Charts Grid */
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '30px' }}>
                {/* Sales timeline line chart */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-highlight)' }}>Daily Revenue Trend</h3>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer>
                      <LineChart data={dashboardData.charts.sales_timeline}>
                        <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--border-glass)', color: '#fff' }} />
                        <Line type="monotone" dataKey="revenue" stroke="var(--secondary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 8 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Top Selling Products bar chart */}
                <div className="glass-card">
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-highlight)' }}>Product Revenue Share</h3>
                  <div style={{ width: '100%', height: '300px' }}>
                    <ResponsiveContainer>
                      <BarChart data={dashboardData.charts.product_sales}>
                        <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={11} />
                        <YAxis stroke="var(--text-muted)" fontSize={11} />
                        <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--border-glass)', color: '#fff' }} />
                        <Bar dataKey="revenue" fill="var(--primary)">
                          {dashboardData.charts.product_sales.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={index === 0 ? 'var(--secondary)' : 'var(--primary)'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Inventory shortage risk list */}
                <div className="glass-card" style={{ gridColumn: 'span 2' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-highlight)' }}>Critical Reorder Alerts</h3>
                  {dashboardData.charts.low_stock.length === 0 ? (
                    <div style={{ color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.95rem' }}>
                      <CheckCircle2 size={18} /> All inventory stock levels are currently robust and safe.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {dashboardData.charts.low_stock.map((item, idx) => (
                        <div key={idx} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '16px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.05)',
                          border: '1px solid rgba(239, 68, 68, 0.15)'
                        }}>
                          <div>
                            <span style={{ fontSize: '1rem', fontWeight: '600', color: 'var(--text-highlight)' }}>{item.product}</span>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                              Current Stock: <strong style={{ color: 'var(--danger)' }}>{item.stock}</strong> units | Reorder Threshold: <strong>{item.reorder}</strong>
                            </div>
                          </div>
                          <button 
                            onClick={() => {
                              setActiveTab('chat');
                              setChatLog(prev => [...prev, {
                                id: uuidv4(),
                                role: 'user',
                                content: `Analyze low stock for ${item.product} and recommend reorder quantity.`
                              }]);
                              setCurrentMessage(`Analyze low stock for ${item.product} and recommend reorder quantity.`);
                            }}
                            className="btn-primary" 
                            style={{ padding: '8px 14px', borderRadius: '6px', fontSize: '0.85rem' }}
                          >
                            Plan Reorder
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Chat tab */}
        {activeTab === 'chat' && (
          <div className="glass-card animate-slide-in" style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            height: '600px',
            padding: '24px'
          }}>
            {/* Chat message logs */}
            <div style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              paddingRight: '8px'
            }}>
              {chatLog.map((msg) => (
                <div key={msg.id} style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                  width: '100%'
                }}>
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxWidth: '80%',
                    gap: '6px'
                  }}>
                    {/* Header */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      fontWeight: '600'
                    }}>
                      {msg.role === 'user' ? <><User size={14} /> You</> : <><Bot size={14} /> BizGuardian Advisor</>}
                    </div>
                    {/* Bubble */}
                    <div style={{
                      padding: '16px',
                      borderRadius: msg.role === 'user' ? '18px 18px 2px 18px' : '18px 18px 18px 2px',
                      background: msg.role === 'user' ? 'var(--primary)' : 'rgba(255, 255, 255, 0.04)',
                      border: msg.role === 'user' ? 'none' : '1px solid var(--border-glass)',
                      color: '#fff',
                      fontSize: '0.95rem',
                      lineHeight: '1.5',
                      whiteSpace: 'pre-wrap'
                    }}>
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))}

              {isChatLoading && (
                <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600' }}>
                      <Bot size={14} /> BizGuardian Advisor
                    </div>
                    <div style={{
                      padding: '12px 18px',
                      borderRadius: '18px 18px 18px 2px',
                      background: 'rgba(255, 255, 255, 0.04)',
                      border: '1px solid var(--border-glass)',
                      display: 'flex',
                      gap: '4px',
                      alignItems: 'center'
                    }}>
                      <div className="glow-cyan" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--secondary)', animation: 'pulse-cyan 1s infinite alternate' }} />
                      <div className="glow-indigo" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--primary)', animation: 'pulse-indigo 1s infinite alternate 0.3s' }} />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '6px' }}>Advisor reasoning...</span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSendMessage} style={{
              display: 'flex',
              gap: '12px',
              borderTop: '1px solid var(--border-glass)',
              paddingTop: '20px'
            }}>
              <input 
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                placeholder="Ask about stock forecast, profit margins, sales analysis, or run a general health check..."
                className="form-input"
                style={{ flex: 1 }}
                disabled={isChatLoading}
              />
              <button 
                type="submit" 
                className="btn-primary"
                disabled={isChatLoading || !currentMessage.trim()}
                style={{ padding: '12px 20px' }}
              >
                Send <Send size={16} />
              </button>
            </form>
          </div>
        )}

        {/* Upload Center */}
        {activeTab === 'upload' && (
          <div className="animate-slide-in" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '30px' }}>
            {/* Sales Upload Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <TrendingUp size={24} color="var(--secondary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-highlight)' }}>Sales Revenue Data</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Upload historical sales invoices. Files should contain columns: **date**, **product_name**, **quantity**, and **price**.
              </p>
              
              <div style={{
                border: '2px dashed var(--border-glass)', borderRadius: '12px', padding: '30px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'var(--transition-fast)',
                background: 'rgba(0, 0, 0, 0.15)'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--secondary)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
              onClick={() => document.getElementById('sales-file-input').click()}
              >
                <UploadCloud size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-highlight)', display: 'block', fontWeight: '600' }}>Choose CSV or Excel</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Max size 10MB</span>
                <input 
                  id="sales-file-input" 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload('sales', e.target.files[0])}
                />
              </div>

              {/* Status Alert */}
              {uploadStatus.sales === 'uploading' && <div style={{ color: 'var(--secondary)', fontSize: '0.85rem' }}>Uploading and seeding sales records...</div>}
              {uploadStatus.sales === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Sales uploaded successfully!</div>}
              {uploadStatus.sales?.startsWith('error') && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{uploadStatus.sales}</div>}
            </div>

            {/* Inventory Upload Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Package size={24} color="var(--primary)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-highlight)' }}>Inventory Stock Levels</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Upload current warehouse inventories. Files should contain: **product_name**, **stock_level**, **reorder_point**, **safety_stock**, and **unit_cost**.
              </p>
              
              <div style={{
                border: '2px dashed var(--border-glass)', borderRadius: '12px', padding: '30px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'var(--transition-fast)',
                background: 'rgba(0, 0, 0, 0.15)'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
              onClick={() => document.getElementById('inv-file-input').click()}
              >
                <UploadCloud size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-highlight)', display: 'block', fontWeight: '600' }}>Choose CSV or Excel</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Max size 10MB</span>
                <input 
                  id="inv-file-input" 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload('inventory', e.target.files[0])}
                />
              </div>

              {/* Status Alert */}
              {uploadStatus.inventory === 'uploading' && <div style={{ color: 'var(--primary)', fontSize: '0.85rem' }}>Uploading inventory catalog...</div>}
              {uploadStatus.inventory === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Inventory uploaded successfully!</div>}
              {uploadStatus.inventory?.startsWith('error') && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{uploadStatus.inventory}</div>}
            </div>

            {/* Financials Upload Card */}
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <DollarSign size={24} color="var(--accent)" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--text-highlight)' }}>Financial & Expense Sheets</h3>
              </div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
                Upload cash outflow and operating expense statements. Files should contain columns: **date**, **category**, **amount**, and optional **description**.
              </p>
              
              <div style={{
                border: '2px dashed var(--border-glass)', borderRadius: '12px', padding: '30px 20px',
                textAlign: 'center', cursor: 'pointer', transition: 'var(--transition-fast)',
                background: 'rgba(0, 0, 0, 0.15)'
              }}
              onMouseOver={(e) => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseOut={(e) => e.currentTarget.style.borderColor = 'var(--border-glass)'}
              onClick={() => document.getElementById('fin-file-input').click()}
              >
                <UploadCloud size={32} color="var(--text-muted)" style={{ margin: '0 auto 10px' }} />
                <span style={{ fontSize: '0.9rem', color: 'var(--text-highlight)', display: 'block', fontWeight: '600' }}>Choose CSV or Excel</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>Max size 10MB</span>
                <input 
                  id="fin-file-input" 
                  type="file" 
                  accept=".csv,.xlsx,.xls" 
                  style={{ display: 'none' }}
                  onChange={(e) => handleFileUpload('financials', e.target.files[0])}
                />
              </div>

              {/* Status Alert */}
              {uploadStatus.financials === 'uploading' && <div style={{ color: 'var(--accent)', fontSize: '0.85rem' }}>Uploading cash logs...</div>}
              {uploadStatus.financials === 'success' && <div style={{ color: 'var(--success)', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}><CheckCircle2 size={14} /> Financials uploaded successfully!</div>}
              {uploadStatus.financials?.startsWith('error') && <div style={{ color: 'var(--danger)', fontSize: '0.85rem' }}>{uploadStatus.financials}</div>}
            </div>
          </div>
        )}

        {/* Security logs tab */}
        {activeTab === 'audit' && (
          <div className="glass-card animate-slide-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: '700', color: 'var(--text-highlight)' }}>Active Guardrail Audit Logs</h3>
              <span style={{ fontSize: '0.75rem', background: 'rgba(99, 102, 241, 0.2)', color: 'var(--primary)', padding: '4px 10px', borderRadius: '20px', fontWeight: '600' }}>
                Secure Mode Active
              </span>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.5' }}>
              The security node sanitizes personal data (PII scrubbing) and neutralizes adversarial threats (prompt injection checking) on all incoming queries before coordinating specialized agents.
            </p>

            <div style={{ overflowX: 'auto', marginTop: '10px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: '600' }}>
                    <th style={{ padding: '12px 16px' }}>Timestamp</th>
                    <th style={{ padding: '12px 16px' }}>Event Category</th>
                    <th style={{ padding: '12px 16px' }}>Security Level</th>
                    <th style={{ padding: '12px 16px' }}>Details / Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                        No security checkpoints logged yet. Make a request to the AI Agent.
                      </td>
                    </tr>
                  ) : (
                    auditLogs.map((log) => (
                      <tr key={log.id} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.04)', fontSize: '0.9rem' }}>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{log.timestamp}</td>
                        <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-highlight)' }}>{log.event_type}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: '600',
                            background: log.severity === 'CRITICAL' ? 'rgba(239, 68, 68, 0.15)' : log.severity === 'WARNING' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(6, 182, 212, 0.15)',
                            color: log.severity === 'CRITICAL' ? 'var(--danger)' : log.severity === 'WARNING' ? 'var(--warning)' : 'var(--secondary)'
                          }}>
                            {log.severity}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', color: 'var(--text-muted)', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {log.details}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
