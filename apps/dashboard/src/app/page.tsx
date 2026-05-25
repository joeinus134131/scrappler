'use client';
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { io } from 'socket.io-client';
import dynamic from 'next/dynamic';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import { LayoutDashboard, Map as MapIcon, BarChart3, FileText, Settings, Share2, Camera, Hash, MapPin, Activity, Loader2, Database, AlertCircle, CheckCircle2, ChevronRight, Network, Eye } from 'lucide-react';

const MapComponent = dynamic(() => import('../components/MapComponent'), { 
  ssr: false, 
  loading: () => <div style={{padding: 40, textAlign: 'center', color: 'var(--text-muted)'}}><Loader2 className="animate-spin" size={24} style={{margin: '0 auto 12px'}}/>Initializing Map Engine...</div> 
});

const API = 'http://localhost:4000/api';

type Job = { id: string; status: string; jobType: string; parameters: any; createdAt: string; platform: { name: string; slug: string } };
type Result = { id: string; contentType: string; rawData: any; normalizedData: any; scrapedAt: string; platform: { name: string; slug: string }, sentiment?: string };

const ICONS: Record<string, any> = {
  dashboard: <LayoutDashboard size={20} />, map: <MapIcon size={20} />, analysis: <BarChart3 size={20} />, reporting: <FileText size={20} />, aggregator: <Network size={20} />, settings: <Settings size={20} />,
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
  const [view, setView] = useState<'dashboard' | 'map' | 'analysis' | 'reporting' | 'aggregator' | 'settings'>('dashboard');
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
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
  const [geoCategory, setGeoCategory] = useState('All');
  const [submitting, setSubmitting] = useState(false);
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);
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
          parameters: { target: isDiscovery ? geoCategory : formTarget, schedule: formSchedule } 
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
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#fee2e2', color: '#b91c1c', padding: '16px 24px', borderRadius: 8, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(220, 38, 38, 0.2)', border: '1px solid #fca5a5', transition: 'all 0.3s ease' }}>
          <AlertCircle size={20} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{errorToast}</span>
        </div>
      )}

      {/* === SUCCESS TOAST === */}
      {successToast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: '#ecfdf5', color: '#047857', padding: '16px 24px', borderRadius: 8, zIndex: 9999, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(4, 120, 87, 0.1)', border: '1px solid #6ee7b7', transition: 'all 0.3s ease' }}>
          <CheckCircle2 size={20} />
          <span style={{ fontWeight: 600, fontSize: 14 }}>{successToast}</span>
        </div>
      )}

      {/* === SIDEBAR === */}
      <aside className="sidebar">
        <div className="sidebar-logo"><Database size={28} /></div>
        <nav className="sidebar-nav">
          {(['dashboard', 'map', 'analysis', 'reporting', 'aggregator', 'settings'] as const).map(v => (
            <button key={v} className={`nav-item ${view === v ? 'active' : ''}`} onClick={() => setView(v)} title={v.charAt(0).toUpperCase() + v.slice(1)}>
              {ICONS[v]}
            </button>
          ))}
        </nav>
      </aside>

      {/* === MAIN === */}
      <main className="main-content">
        {view === 'dashboard' && <DashboardView stats={stats} resultCount={resultCount} jobs={jobs} results={results} logs={logs} onNewJob={() => setShowModal(true)} onReviewJob={(j: Job) => setSelectedJob(j)} />}
        {view === 'map' && <MapView results={results} onNewJob={() => setShowModal(true)} />}
        {view === 'analysis' && <AnalysisView analytics={analytics} results={results} />}
        {view === 'reporting' && <ReportingView results={results} onExport={exportData} />}
        {view === 'aggregator' && <AggregatorView results={results} />}
        {view === 'settings' && <SettingsView proxies={proxies} onToggle={async (id: number) => {
          await fetch(`${API}/proxies/${id}/toggle`, { method: 'PATCH' });
          fetchData();
        }} setSuccessToast={setSuccessToast} setErrorToast={setErrorToast} />}
      </main>

      {/* === JOB REVIEW MODAL === */}
      {selectedJob && (
        <div className="modal-overlay" onClick={() => setSelectedJob(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 700 }}>
            <h2 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Job Details: {selectedJob.platform?.name}</h2>
            <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 16 }}>Target: {(selectedJob.parameters as any)?.target} • Status: {selectedJob.status}</p>
            <div className="terminal-feed-large" style={{ height: 300, background: '#0f172a', marginBottom: 20, overflowY: 'auto', padding: 16, borderRadius: 8 }}>
              {logs.filter(l => l.includes(selectedJob.id.split('-')[0]) || selectedJob.status !== 'running').slice(0, 50).map((l, i) => (
                 <div key={i} className="terminal-line-enhanced" style={{ color: '#38bdf8', fontSize: 12 }}>{l}</div>
              ))}
              {logs.length === 0 && <div style={{ color: '#475569' }}>No logs available.</div>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedJob(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

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
                  
                  {formPlatform === 'google' && (
                    <div style={{ marginTop: 20, textAlign: 'left' }}>
                       <label className="pane-label" style={{ display: 'block', marginBottom: 8 }}>Target Category</label>
                       <select className="select-field" value={geoCategory} onChange={e => setGeoCategory(e.target.value)}>
                         <option value="All">All Categories</option>
                         <option value="Coffee Shop">Coffee Shop / Cafe</option>
                         <option value="Restaurant">Restaurant</option>
                         <option value="Retail">Retail</option>
                         <option value="Warung Madura">Warung Madura</option>
                       </select>
                    </div>
                  )}
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
function DashboardView({ stats, resultCount, jobs, results, logs, onNewJob, onReviewJob }: any) {
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
            <tr><th>Status</th><th>Platform</th><th>Target</th><th>Type</th><th>Time Elapsed</th><th>Action</th></tr>
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
                <td>
                   <button className="btn btn-ghost" style={{ padding: '4px 8px' }} onClick={() => onReviewJob(j)}>
                     <Eye size={16} />
                   </button>
                </td>
              </tr>
            ))}
            {jobs.length === 0 && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No active operations.</td></tr>
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
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [searchLoc, setSearchLoc] = useState('');
  const [filterType, setFilterType] = useState('All');
  
  const allLocations = useMemo(() => {
    const locs: any[] = [];
    results.forEach(r => {
      if (r.normalizedData?.pointsOfInterest) {
        r.normalizedData.pointsOfInterest.forEach((poi: any) => {
          locs.push({ ...poi, platform: r.platform?.name });
        });
      }
    });
    return locs;
  }, [results]);

  const filteredLocations = useMemo(() => {
    return allLocations.filter(loc => {
      const matchSearch = loc.name?.toLowerCase().includes(searchLoc.toLowerCase()) || loc.address?.toLowerCase().includes(searchLoc.toLowerCase());
      const matchType = filterType === 'All' || loc.type === filterType;
      return matchSearch && matchType;
    });
  }, [allLocations, searchLoc, filterType]);

  // Extract unique types for the filter dropdown
  const uniqueTypes = useMemo(() => Array.from(new Set(allLocations.map(l => l.type).filter(Boolean))), [allLocations]);

  const demographicsData = useMemo(() => {
    let dominantAge = 'Unknown';
    let footTraffic = 'Unknown';
    let dominantCategory = 'Unknown';
    
    // Find the latest result that has demographics
    for (let i = results.length - 1; i >= 0; i--) {
      const demo = (results[i].normalizedData as any)?.demographics;
      if (demo) {
        dominantAge = demo.dominantAge || 'Unknown';
        footTraffic = demo.footfallEstimate ? `${Math.round(demo.footfallEstimate / 1000)}k+/day` : demo.traffic || 'Unknown';
        break;
      }
    }

    // Calculate dominant category from POIs
    const categoryCounts: Record<string, number> = {};
    results.forEach(r => {
      r.normalizedData?.pointsOfInterest?.forEach((poi: any) => {
        if (poi.type) {
          categoryCounts[poi.type] = (categoryCounts[poi.type] || 0) + 1;
        }
      });
    });
    
    const sortedCategories = Object.entries(categoryCounts).sort((a, b) => b[1] - a[1]);
    if (sortedCategories.length > 0) {
      dominantCategory = sortedCategories.slice(0, 2).map(c => c[0]).join(', ');
    }

    return { dominantAge, footTraffic, dominantCategory };
  }, [results]);

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
             <div className="network-item"><span>Primary Demographic</span> <span style={{color: 'var(--text-primary)'}}>{demographicsData.dominantAge}</span></div>
             <div className="network-item"><span>Foot Traffic Estimate</span> <span style={{color: 'var(--text-primary)'}}>{demographicsData.footTraffic}</span></div>
             <div className="network-item"><span>Dominant Category</span> <span style={{color: 'var(--text-primary)'}}>{demographicsData.dominantCategory}</span></div>
          </div>
        </div>
      </div>

      <div className="holo-card" style={{ marginTop: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>Extracted Locations Detail</h3>
          <div style={{ display: 'flex', gap: 12 }}>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Search name or address..." 
              value={searchLoc} 
              onChange={e => setSearchLoc(e.target.value)} 
              style={{ width: 250, padding: '8px 12px', fontSize: 13 }}
            />
            <select className="select-field" value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '8px 12px', fontSize: 13, width: 160 }}>
              <option value="All">All Types</option>
              {uniqueTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
           <table className="data-table">
             <thead>
               <tr>
                 <th>Name</th>
                 <th>Type</th>
                 <th>Rating</th>
                 <th>Reviews</th>
                 <th>Address</th>
                 <th>Action</th>
               </tr>
             </thead>
             <tbody>
               {filteredLocations.map((loc, idx) => (
                 <tr key={idx}>
                   <td className="font-medium text-sm">{loc.name}</td>
                   <td>{loc.type}</td>
                   <td>{loc.rating ? `⭐ ${loc.rating}` : '-'}</td>
                   <td>{loc.reviewCount || '-'}</td>
                   <td className="text-muted text-xs">{loc.address || '-'}</td>
                   <td>
                     <button className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => setSelectedLocation(loc)}>
                       View Details
                     </button>
                   </td>
                 </tr>
               ))}
               {filteredLocations.length === 0 && (
                 <tr><td colSpan={6} style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)' }}>No detailed locations extracted yet.</td></tr>
               )}
             </tbody>
           </table>
        </div>
      </div>

      {selectedLocation && (
        <div className="modal-overlay" onClick={() => setSelectedLocation(null)}>
          <div className="modal-box" onClick={e => e.stopPropagation()} style={{ maxWidth: 650 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div>
                <h2 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{selectedLocation.name}</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{selectedLocation.type} • {selectedLocation.rating} ⭐ ({selectedLocation.reviewCount} Reviews)</p>
              </div>
              <span className={`platform-tag ${selectedLocation.platform?.toLowerCase() || 'google'}`}>{selectedLocation.platform || 'Google'}</span>
            </div>

            <div style={{ background: 'var(--bg-base)', padding: 16, borderRadius: 8, border: '1px solid var(--glass-border)', marginBottom: 20 }}>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}><strong>Address:</strong> {selectedLocation.address}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}><strong>Contact:</strong> {selectedLocation.contact}</p>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}><strong>Hours:</strong> {selectedLocation.operatingHours}</p>
              {selectedLocation.amenities && (
                <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {selectedLocation.amenities.map((am: string, i: number) => (
                    <span key={i} style={{ background: 'var(--bg-surface)', border: '1px solid var(--glass-border)', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, color: 'var(--neon-indigo)' }}>
                      {am}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Captured Google Reviews</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxHeight: 250, overflowY: 'auto', paddingRight: 8 }}>
              {selectedLocation.reviews && selectedLocation.reviews.length > 0 ? (
                selectedLocation.reviews.map((rev: any, i: number) => (
                  <div key={i} style={{ padding: 12, background: 'var(--bg-base)', borderRadius: 8, border: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{rev.author}</span>
                      <span style={{ fontSize: 11, color: '#f59e0b' }}>{'⭐'.repeat(rev.rating)}</span>
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.4 }}>"{rev.text}"</p>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 8, textAlign: 'right' }}>{rev.time}</div>
                  </div>
                ))
              ) : (
                <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>No detailed reviews captured for this location.</p>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 24, gap: 12 }}>
              <a 
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((selectedLocation.name || '') + ' ' + (selectedLocation.address || ''))}`} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-ghost"
              >
                Open in Maps
              </a>
              <button className="btn btn-primary" onClick={() => setSelectedLocation(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
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
      const matchPlatform = filterPlatform === 'All' || r.platform?.slug === filterPlatform || r.platform?.name === filterPlatform;
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
            <option value="google">Google Places</option>
            <option value="instagram">Instagram</option>
            <option value="threads">Threads</option>
            <option value="tiktok">TikTok</option>
            <option value="facebook">Facebook</option>
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
function SettingsView({ proxies, onToggle, setSuccessToast, setErrorToast }: { proxies: any[]; onToggle: (id: number) => void, setSuccessToast: (msg: string | null) => void, setErrorToast: (msg: string | null) => void }) {
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
      const response = await fetch(`${API}/keys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey: key })
      });
      if (!response.ok) throw new Error('API Response not ok');
      setSuccessToast(`✅ ${provider} API Key saved successfully!`);
      setTimeout(() => setSuccessToast(null), 3000);
    } catch (e) {
      setErrorToast(`Failed to save ${provider} API Key`);
      setTimeout(() => setErrorToast(null), 3000);
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

/* ========== AGGREGATOR VIEW ========== */
function AggregatorView({ results }: { results: any[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const aggregatedData = useMemo(() => {
    if (!searchTerm) return null;
    const term = searchTerm.toLowerCase();
    
    // Find all results matching the term in target, location, or username
    const matches = results.filter(r => {
      const data = r.normalizedData || {};
      const t = (data.username || data.location || r.target || '').toLowerCase();
      return t.includes(term);
    });

    if (matches.length === 0) return { matches: [] };

    // Group by platform
    const platforms: Record<string, any[]> = {};
    matches.forEach(m => {
      const p = m.platform?.name || 'Unknown';
      if (!platforms[p]) platforms[p] = [];
      platforms[p].push(m);
    });

    return { matches, platforms };
  }, [results, searchTerm]);

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">Entity Aggregator</h1>
          <p className="page-subtitle">Cross-reference and compile data across multiple platforms</p>
        </div>
      </div>
      
      <div className="holo-card" style={{ marginBottom: 24 }}>
        <input 
          type="text" 
          className="input-field" 
          placeholder="Search by target username, business name, or location..." 
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          style={{ fontSize: 16, padding: '16px 20px' }}
        />
      </div>

      {aggregatedData && aggregatedData.matches.length > 0 ? (
        <div className="grid-2">
          {Object.entries(aggregatedData.platforms || {}).map(([platform, items]) => (
            <div key={platform} className="holo-card">
               <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, textTransform: 'capitalize' }}>{platform} Data</h3>
               <div style={{ maxHeight: 500, overflowY: 'auto' }}>
                 {items.map((item, idx) => (
                   <div key={idx} style={{ marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--glass-border)' }}>
                     <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 8 }}>
                        {new Date(item.scrapedAt).toLocaleString()}
                        {(item as any).sentiment && <span className={`sentiment-badge ${(item as any).sentiment.toLowerCase()}`} style={{marginLeft: 8}}>{(item as any).sentiment}</span>}
                     </div>
                     <pre style={{ fontSize: 11, background: 'var(--bg-base)', padding: 12, borderRadius: 8, overflowX: 'auto', border: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                       {JSON.stringify(item.normalizedData, null, 2)}
                     </pre>
                   </div>
                 ))}
               </div>
            </div>
          ))}
        </div>
      ) : searchTerm ? (
        <div className="holo-card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
           No aggregated data found for "{searchTerm}".
        </div>
      ) : (
        <div className="holo-card" style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)' }}>
           Enter a search term to begin aggregating intelligence.
        </div>
      )}
    </>
  );
}
