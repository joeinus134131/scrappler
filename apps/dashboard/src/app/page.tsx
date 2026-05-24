'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { LayoutDashboard, Map as MapIcon, BarChart3, FileText, Settings, Share2, Camera, Hash, MapPin, Activity, Loader2, Database, AlertCircle, CheckCircle2, ChevronRight } from 'lucide-react';

const MapComponent = dynamic(() => import('../components/MapComponent'), { 
  ssr: false, 
  loading: () => <div style={{padding: 40, textAlign: 'center', color: 'var(--text-muted)'}}><Loader2 className="animate-spin" size={24} style={{margin: '0 auto 12px'}}/>Initializing Map Engine...</div> 
});

const API = 'http://localhost:4000/api';

type Job = { id: string; status: string; jobType: string; parameters: any; createdAt: string; platform: { name: string; slug: string } };
type Result = { id: string; contentType: string; rawData: any; normalizedData: any; scrapedAt: string; platform: { name: string; slug: string }, sentiment?: string };

const ICONS: Record<string, any> = {
  dashboard: <LayoutDashboard size={20} />, map: <MapIcon size={20} />, analysis: <BarChart3 size={20} />, reporting: <FileText size={20} />, settings: <Settings size={20} />,
};

const PLATFORM_ICONS: Record<string, any> = {
  threads: <Hash size={24} />, facebook: <Share2 size={24} />, instagram: <Camera size={24} />, tiktok: <Activity size={24} />, google: <MapPin size={24} />,
};

function timeAgo(d: string) {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Dashboard() {
  const [view, setView] = useState<'dashboard' | 'map' | 'analysis' | 'reporting' | 'settings'>('dashboard');
  const [jobs, setJobs] = useState<Job[]>([]);
  const [results, setResults] = useState<Result[]>([]);
  const [proxies, setProxies] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>({});
  const [stats, setStats] = useState({ total: 0, completed: 0, failed: 0, running: 0 });
  const [resultCount, setResultCount] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [formPlatform, setFormPlatform] = useState('instagram');
  const [formTarget, setFormTarget] = useState('');
  const [formSchedule, setFormSchedule] = useState('none');
  const [isDiscovery, setIsDiscovery] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([
    '[SYS] Scrappler Engine v2.0 initialized',
    '[SYS] Playwright browser pool ready',
    '[SYS] BullMQ worker connected to Redis',
  ]);
  const socketRef = useRef<any>(null);

  useEffect(() => {
    socketRef.current = io('http://localhost:4000');
    socketRef.current.on('job_status', (data: any) => {
      setLogs(prev => [`[${data.status.toUpperCase()}] ${data.message}`, ...prev.slice(0, 49)]);
      if (data.status === 'completed') fetchData();
    });
    return () => socketRef.current.disconnect();
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const [jRes, sRes, rRes, rcRes, aRes, pRes] = await Promise.all([
        fetch(`${API}/jobs`).then(r => r.json()).catch(() => []),
        fetch(`${API}/jobs/stats`).then(r => r.json()).catch(() => ({ total: 0, completed: 0, failed: 0, running: 0 })),
        fetch(`${API}/results`).then(r => r.json()).catch(() => []),
        fetch(`${API}/results/stats`).then(r => r.json()).catch(() => ({ total: 0 })),
        fetch(`${API}/analytics/trends`).then(r => r.json()).catch(() => ({})),
        fetch(`${API}/proxies`).then(r => r.json()).catch(() => []),
      ]);
      setJobs(Array.isArray(jRes) ? jRes : []);
      setStats(sRes);
      setResults(Array.isArray(rRes) ? rRes : []);
      setResultCount(rcRes?.total || 0);
      setAnalytics(aRes || {});
      setProxies(Array.isArray(pRes) ? pRes : []);
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchData(); const i = setInterval(fetchData, 10000); return () => clearInterval(i); }, [fetchData]);

  const submitJob = async () => {
    if (!isDiscovery && !formTarget.trim()) return;
    setSubmitting(true);
    setErrorToast(null);
    try {
      const res = await fetch(`${API}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platform: formPlatform, 
          jobType: isDiscovery ? 'geo-discovery' : 'profile',
          parameters: { target: isDiscovery ? 'TRENDING_LOCATION' : formTarget, schedule: formSchedule } 
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setLogs(prev => [`[NEW] Task queued: ${formPlatform} ${isDiscovery ? '(Geo Discovery)' : formTarget} → ${data.jobId.slice(0, 8)}`, ...prev]);
      setShowModal(false); setFormTarget(''); setIsDiscovery(false); setFormSchedule('none');
      fetchData();
    } catch (e: any) {
      setLogs(prev => [`[ERR] Failed to submit task: ${e.message}`, ...prev]);
      setErrorToast(e.message || 'Database connection failed');
      setTimeout(() => setErrorToast(null), 5000);
    }
    setSubmitting(false);
  };

  const exportData = (type: 'json' | 'csv' | 'pdf') => {
    window.open(`${API}/export/${type}`, '_blank');
  };

  return (
    <div className="app-shell">
      {/* === ERROR TOAST === */}
      {errorToast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#fee2e2', color: '#b91c1c', padding: '16px 24px', borderRadius: 8, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)', border: '1px solid #fca5a5' }}>
          <AlertCircle size={20} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{errorToast}</span>
        </div>
      )}

      {/* === SIDEBAR === */}
      <aside className="sidebar">
        <div className="sidebar-logo"><Database size={28} /></div>
        <nav className="sidebar-nav">
          {(['dashboard', 'map', 'analysis', 'reporting', 'settings'] as const).map(v => (
            <button key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)} title={v.charAt(0).toUpperCase() + v.slice(1)}>
              {ICONS[v]}
            </button>
          ))}
        </nav>
      </aside>

      {/* === MAIN === */}
      <main className="main-content">
        {view === 'dashboard' && <DashboardView stats={stats} resultCount={resultCount} jobs={jobs} results={results} logs={logs} onNewJob={() => setShowModal(true)} />}
        {view === 'map' && <MapView results={results} onNewJob={() => setShowModal(true)} />}
        {view === 'analysis' && <AnalysisView analytics={analytics} results={results} />}
        {view === 'reporting' && <ReportingView results={results} onExport={exportData} />}
        {view === 'settings' && <SettingsView proxies={proxies} onToggle={async (id: number) => {
          await fetch(`${API}/proxies/${id}/toggle`, { method: 'PATCH' });
          fetchData();
        }} />}
      </main>

      {/* === NEW JOB MODAL === */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-box" onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8, color: 'var(--text-primary)' }}>New Extraction Task</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 24 }}>Configure data extraction parameters.</p>
            
            <div style={{ marginBottom: 24 }}>
              <label className="pane-label" style={{ display: 'block', marginBottom: 12 }}>Target Platform</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
                {['threads', 'facebook', 'instagram', 'tiktok', 'google'].map(p => (
                  <button key={p} onClick={() => setFormPlatform(p)} style={{
                    padding: '16px 8px', borderRadius: 'var(--radius-md)', border: `1px solid ${formPlatform === p ? `var(--${p})` : 'var(--glass-border)'}`,
                    background: formPlatform === p ? 'var(--bg-elevated)' : 'var(--bg-surface)', color: formPlatform === p ? `var(--${p})` : 'var(--text-muted)',
                    cursor: 'pointer', textAlign: 'center', transition: 'var(--transition-fast)',
                    boxShadow: formPlatform === p ? `0 0 0 2px var(--${p})` : 'none',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>{PLATFORM_ICONS[p]}</div>
                    <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase' }}>{p}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ marginBottom: 24, padding: 20, background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <label className="pane-label" style={{ marginBottom: 0 }}>Extraction Mode</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={() => setIsDiscovery(false)} className={`btn-toggle ${!isDiscovery ? 'active' : ''}`}>Targeted</button>
                  <button onClick={() => setIsDiscovery(true)} className={`btn-toggle ${isDiscovery ? 'active' : ''}`}>Geo/Demographics</button>
                </div>
              </div>
              {!isDiscovery ? (
                <div>
                  <input className="input-field" placeholder="Target username, URL, or search query..." value={formTarget} onChange={e => setFormTarget(e.target.value)} onKeyDown={e => e.key === 'Enter' && submitJob()} autoFocus />
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>Extracts profile data, posts, and engagement metrics.</p>
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '16px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12, color: 'var(--neon-indigo)' }}><MapPin size={32} /></div>
                  <p style={{ fontSize: 14, color: 'var(--neon-indigo)', fontWeight: 700 }}>Geospatial Scanning Mode</p>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>Scans {formPlatform} for location check-ins, retail POIs, and demographic signals.</p>
                </div>
              )}
            </div>

            <div style={{ marginBottom: 32 }}>
              <label className="pane-label" style={{ display: 'block', marginBottom: 12 }}>Automation Schedule (Auto-Update)</label>
              <select className="select-field" value={formSchedule} onChange={e => setFormSchedule(e.target.value)}>
                <option value="none">Run Once</option>
                <option value="hourly">Every Hour</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitJob} disabled={submitting} style={{ minWidth: 160, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
                {submitting ? <><Loader2 className="animate-spin" size={16} /> Initializing...</> : 'Launch Task'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ========== DASHBOARD VIEW ========== */
function DashboardView({ stats, resultCount, jobs, results, logs, onNewJob }: any) {
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Mission Control</h1>
          <p className="page-subtitle">Real-time data intelligence overview</p>
        </div>
        <button className="btn btn-primary" onClick={onNewJob}>+ New Task</button>
      </div>

      <div className="stats-grid">
        <StatCard icon={<Activity />} value={stats.total} label="Total Tasks" trend="Active Operations" />
        <StatCard icon={<Database />} value={resultCount} label="Data Points" trend="Total Extracted" />
        <StatCard icon={<CheckCircle2 />} value={stats.completed} label="Successful" trend="100% Extraction" />
        <StatCard icon={<AlertCircle />} value={stats.failed} label="Failures" trend="Needs Attention" />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="holo-card" style={{ gridColumn: 'span 2' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>System Terminal</h3>
            <div className="live-indicator">Online</div>
          </div>
          <div className="terminal-feed-large">
            {logs.map((l: string, i: number) => (
              <div key={i} className="terminal-line-enhanced">
                <span className="timestamp" suppressHydrationWarning>{new Date().toLocaleTimeString()}</span>
                <span className="cursor-char"> <ChevronRight size={14} style={{ display: 'inline' }} /> </span>
                <span className="content">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="holo-card">
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Active Scraping Operations</h3>
        <table className="data-table">
          <thead>
            <tr><th>Status</th><th>Platform</th><th>Target</th><th>Type</th><th>Time Elapsed</th></tr>
          </thead>
          <tbody>
            {jobs.slice(0, 8).map((j: Job) => (
              <tr key={j.id}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className={`status-pill ${j.status}`}>
                      {j.status === 'running' && <Loader2 className="animate-spin" size={12} style={{ marginRight: 4 }} />}
                      {j.status}
                    </span>
                  </div>
                </td>
                <td><span className={`platform-tag ${j.platform?.slug}`}>{j.platform?.name}</span></td>
                <td className="text-sm font-medium">{(j.parameters as any)?.target || 'GLOBAL_SCAN'}</td>
                <td><span className="text-xs font-semibold text-muted" style={{ textTransform: 'uppercase' }}>{j.jobType}</span></td>
                <td className="text-sm text-muted">{timeAgo(j.createdAt)}</td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No active operations.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

/* ========== MAP VIEW ========== */
function MapView({ results, onNewJob }: { results: any[]; onNewJob: () => void }) {
  const geoResults = results.filter(r => r.job?.jobType === 'geo-discovery' || (r.normalizedData as any)?.location);
  
  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Geospatial & Demographics</h1>
          <p className="page-subtitle">Interactive map of retail distribution and population signals</p>
        </div>
        <button className="btn btn-primary" onClick={onNewJob}>+ Geo Scan</button>
      </div>
      
      <div className="holo-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '500px', zIndex: 1 }}>
        <MapComponent results={results} />
      </div>

      <div className="grid-2 mt-4">
        <div className="holo-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Recent Geo Signals</h3>
          <div className="results-list">
            {geoResults.slice(0, 3).map(r => (
              <div key={r.id} className="signal-row">
                <span className={`platform-tag ${r.platform?.slug}`}>{r.platform?.name}</span>
                <div className="signal-target">{(r.normalizedData as any).location || 'Unknown Location'}</div>
                <span className="signal-time">{timeAgo(r.scrapedAt)}</span>
              </div>
            ))}
            {geoResults.length === 0 && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No geo-data collected yet.</p>}
          </div>
        </div>
        <div className="holo-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Demographic Estimation</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             <div className="network-item"><span>Primary Demographic</span> <span style={{color: 'var(--text-primary)'}}>Young Adults (18-24)</span></div>
             <div className="network-item"><span>Foot Traffic Estimate</span> <span style={{color: 'var(--text-primary)'}}>High (10k+/day)</span></div>
             <div className="network-item"><span>Dominant Category</span> <span style={{color: 'var(--text-primary)'}}>F&B, Retail</span></div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ========== ANALYSIS VIEW ========== */
function AnalysisView({ analytics, results }: { analytics: any; results: any[] }) {
  const chartData = useMemo(() => {
    const dates = Object.keys(analytics).sort();
    return dates.map(d => ({
      name: d,
      threads: analytics[d].threads || 0,
      instagram: analytics[d].instagram || 0,
      facebook: analytics[d].facebook || 0,
      tiktok: analytics[d].tiktok || 0,
      google: analytics[d].google || 0,
    }));
  }, [analytics]);

  const pieData = useMemo(() => {
    let pos = 0, neg = 0, neu = 0;
    results.forEach(r => {
      if (r.sentiment?.toLowerCase() === 'positive') pos++;
      else if (r.sentiment?.toLowerCase() === 'negative') neg++;
      else neu++;
    });
    return [
      { name: 'Positive', value: pos },
      { name: 'Neutral', value: neu },
      { name: 'Negative', value: neg },
    ];
  }, [results]);

  const COLORS = ['#10b981', '#cbd5e1', '#f43f5e'];

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Data Analysis</h1>
          <p className="page-subtitle">Categorize and analyze extracted intelligence dynamically</p>
        </div>
      </div>
      
      <div className="grid-3 mb-4">
        <div className="holo-card" style={{ gridColumn: 'span 2' }}>
           <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 24 }}>Data Extraction Volume (Timeline)</h3>
           <div style={{ height: 300, width: '100%' }}>
             <ResponsiveContainer>
                <LineChart data={chartData}>
                  <XAxis dataKey="name" fontSize={12} stroke="#64748b" />
                  <YAxis fontSize={12} stroke="#64748b" />
                  <Tooltip />
                  <Line type="monotone" dataKey="instagram" stroke="#e1306c" strokeWidth={3} />
                  <Line type="monotone" dataKey="threads" stroke="#000000" strokeWidth={3} />
                  <Line type="monotone" dataKey="google" stroke="#4f46e5" strokeWidth={3} />
                </LineChart>
             </ResponsiveContainer>
           </div>
           {chartData.length === 0 && <p style={{textAlign: 'center', color: '#94a3b8', fontSize: 14}}>No historical data yet.</p>}
        </div>
        <div className="holo-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16 }}>Sentiment Breakdown</h3>
          <div style={{ height: 250, width: '100%' }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, fontSize: 12, fontWeight: 600 }}>
            <span style={{ color: COLORS[0] }}>Positive ({pieData[0].value})</span>
            <span style={{ color: COLORS[1] }}>Neutral ({pieData[1].value})</span>
            <span style={{ color: COLORS[2] }}>Negative ({pieData[2].value})</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ========== REPORTING VIEW ========== */
function ReportingView({ results, onExport }: { results: Result[]; onExport: (type: 'json' | 'csv' | 'pdf') => void }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filterPlatform, setFilterPlatform] = useState('All');
  const [filterSentiment, setFilterSentiment] = useState('All');

  const filteredResults = useMemo(() => {
    return results.filter(r => {
      const matchPlatform = filterPlatform === 'All' || r.platform?.name === filterPlatform;
      const matchSentiment = filterSentiment === 'All' || r.sentiment === filterSentiment;
      return matchPlatform && matchSentiment;
    });
  }, [results, filterPlatform, filterSentiment]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Reports & Vault</h1>
          <p className="page-subtitle">Filter and export highly specific data reports</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-ghost" onClick={() => onExport('csv')}>Export CSV</button>
          <button className="btn btn-primary" onClick={() => onExport('pdf')}>Generate PDF Report</button>
        </div>
      </div>
      
      <div className="holo-card" style={{ marginBottom: 24, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Interactive Filters</h3>
        <div className="grid-3">
          <select className="select-field" value={filterPlatform} onChange={e => setFilterPlatform(e.target.value)}>
            <option value="All">All Platforms</option>
            <option value="Google Places">Google Places</option>
            <option value="Instagram">Instagram</option>
            <option value="Threads">Threads</option>
          </select>
          <select className="select-field" value={filterSentiment} onChange={e => setFilterSentiment(e.target.value)}>
            <option value="All">All Sentiments</option>
            <option value="Positive">Positive</option>
            <option value="Neutral">Neutral</option>
            <option value="Negative">Negative</option>
          </select>
          <select className="select-field"><option>Last 7 Days (Default)</option></select>
        </div>
      </div>

      <div className="results-list">
        {filteredResults.map(r => (
          <div key={r.id} className={`result-item ${expanded === r.id ? 'expanded' : ''}`}>
            <div className="result-header" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
              <span className={`platform-tag ${r.platform?.slug}`}>{r.platform?.name}</span>
              <span className="result-title">{(r.normalizedData as any).username || (r.normalizedData as any).title || (r.normalizedData as any).location || 'Extracted Data Entry'}</span>
              <div style={{ flex: 1 }}></div>
              {(r as any).sentiment && <span className={`sentiment-badge ${(r as any).sentiment.toLowerCase()}`}>{(r as any).sentiment}</span>}
              <span className="signal-time">{timeAgo(r.scrapedAt)}</span>
            </div>
            {expanded === r.id && (
              <div className="result-body">
                <div className="data-grid">
                  <div className="data-pane">
                    <div className="pane-label">Structured Output</div>
                    <pre>{JSON.stringify(r.normalizedData, null, 2)}</pre>
                  </div>
                  <div className="data-pane">
                    <div className="pane-label">Raw Response</div>
                    <pre>{JSON.stringify(r.rawData, null, 2)}</pre>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {filteredResults.length === 0 && (
          <div className="holo-card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
             No data matches the selected filters.
          </div>
        )}
      </div>
    </>
  );
}

/* ========== SETTINGS VIEW ========== */
function SettingsView({ proxies, onToggle }: { proxies: any[]; onToggle: (id: number) => void }) {
  const [rapidKey, setRapidKey] = useState('');
  const [apifyKey, setApifyKey] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/keys`).then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        const rap = data.find(d => d.provider === 'rapidapi');
        const api = data.find(d => d.provider === 'apify');
        if (rap) setRapidKey(rap.apiKey);
        if (api) setApifyKey(api.apiKey);
      }
    }).catch(console.error);
  }, []);

  const saveKey = async (provider: string, key: string) => {
    setSaving(true);
    try {
      await fetch(`${API}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key })
      });
      alert(`✅ ${provider} API Key saved successfully!`);
    } catch (e) {
      alert(`Failed to save ${provider} API Key`);
    }
    setSaving(false);
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Platform Configuration</h1>
          <p className="page-subtitle">Manage proxies, API keys, and system parameters</p>
        </div>
      </div>
      <div className="grid-2">
        <div className="holo-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Third-Party API Integrations</h3>
          <p style={{fontSize: 12, color: 'var(--text-muted)', marginBottom: 16}}>
            Connect Scrappler Engine to external data aggregators to bypass anti-bot systems.
          </p>
          
          <div style={{ marginBottom: 16 }}>
            <label className="pane-label" style={{ display: 'block', marginBottom: 8 }}>RapidAPI Key</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" placeholder="Enter RapidAPI Key" className="input-field" value={rapidKey} onChange={e => setRapidKey(e.target.value)} />
              <button className="btn btn-primary" onClick={() => saveKey('rapidapi', rapidKey)} disabled={saving}>Save</button>
            </div>
          </div>
          
          <div style={{ marginBottom: 16 }}>
            <label className="pane-label" style={{ display: 'block', marginBottom: 8 }}>Apify Access Token</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="password" placeholder="Enter Apify Token" className="input-field" value={apifyKey} onChange={e => setApifyKey(e.target.value)} />
              <button className="btn btn-primary" onClick={() => saveKey('apify', apifyKey)} disabled={saving}>Save</button>
            </div>
          </div>
          
          <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--glass-border)' }}>
             <ConfigRow label="Google Places API Key" value="Connected" status="ok" />
             <ConfigRow label="BPS / Census Demographic API" value="Not Configured" status="warn" />
             <ConfigRow label="PostgreSQL Vector DB" value="Connected" status="ok" />
          </div>
        </div>
        
        <div className="holo-card">
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20 }}>Proxy Network</h3>
          <table className="data-table" style={{ marginTop: -10 }}>
            <thead>
              <tr><th>Node Address</th><th>Health</th></tr>
            </thead>
            <tbody>
              {proxies.map(p => (
                <tr key={p.id}>
                  <td className="text-sm font-mono">{p.host}:{p.port}</td>
                  <td>
                    <div className="health-bar" style={{ width: 60 }}>
                      <div className="health-fill" style={{ width: `${Math.max(0, 100 - p.failCount * 20)}%` }}></div>
                    </div>
                  </td>
                </tr>
              ))}
              {proxies.length === 0 && <tr><td colSpan={2} style={{ color: 'var(--text-muted)', fontSize: 13, paddingTop: 16 }}>No proxies configured.</td></tr>}
            </tbody>
          </table>
          <button className="btn btn-ghost" style={{ marginTop: 24, width: '100%' }}>Add Proxy Nodes</button>
        </div>
      </div>
    </>
  );
}

function ConfigRow({ label, value, status }: { label: string; value: string; status?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 12, borderBottom: '1px solid #f1f5f9' }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{value}</span>
        {status === 'ok' && <span className="status-dot completed" />}
        {status === 'warn' && <span className="status-dot pending" />}
      </div>
    </div>
  );
}

function StatCard({ icon, value, label, trend }: { icon: React.ReactNode; value: number; label: string; trend: string }) {
  return (
    <div className="stat-card">
      <div className="stat-icon" style={{ background: '#f1f5f9', color: 'var(--neon-indigo)' }}>{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      <div className="stat-trend">{trend}</div>
    </div>
  );
}
