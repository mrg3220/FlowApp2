import { useState, useEffect, useCallback } from 'react';
import { sreApi } from '../api/client';

const REFRESH_INTERVAL = 30_000; // 30 seconds

export default function SREDashboardPage() {
  const [tab, setTab] = useState('overview');

  return (
    <div>
      <h1>📡 SRE Dashboard</h1>
      <p style={{ color: '#8892a4', marginBottom: '1rem' }}>
        System reliability, observability, and performance monitoring
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'overview', label: '📊 Overview' },
          { key: 'health', label: '💓 Health' },
          { key: 'database', label: '🗄️ Database' },
          { key: 'requests', label: '📈 Requests' },
          { key: 'errors', label: '🚨 Errors' },
          { key: 'runtime', label: '⚙️ Runtime' },
        ].map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'overview' && <SREOverview />}
      {tab === 'health' && <SystemHealth />}
      {tab === 'database' && <DatabaseMetrics />}
      {tab === 'requests' && <RequestMetrics />}
      {tab === 'errors' && <ErrorLogs />}
      {tab === 'runtime' && <RuntimeInfo />}
    </div>
  );
}

// ─── SRE Overview ────────────────────────────────────────

function SREOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);

  const fetch = useCallback(async () => {
    try {
      const d = await sreApi.getDashboard();
      setData(d);
      setLastRefresh(new Date());
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetch]);

  if (loading) return <div className="loading">Loading SRE dashboard...</div>;
  if (!data) return <p>Failed to load dashboard</p>;

  const healthColor = data.health.status === 'healthy' ? '#2ed573' : '#ff4757';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ width: 12, height: 12, borderRadius: '50%', background: healthColor, display: 'inline-block', boxShadow: `0 0 8px ${healthColor}` }} />
          <span style={{ fontWeight: 700, fontSize: '1.1rem', color: healthColor, textTransform: 'uppercase' }}>{data.health.status}</span>
        </div>
        {lastRefresh && <span style={{ fontSize: '0.8rem', color: '#8892a4' }}>Last refreshed: {lastRefresh.toLocaleTimeString()} (auto-refresh 30s)</span>}
      </div>

      {/* Top stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard label="Uptime" value={data.health.uptime} icon="⏱️" />
        <MetricCard label="Node.js" value={data.health.nodeVersion} icon="🟢" />
        <MetricCard label="Environment" value={data.health.environment} icon="🌍" />
        <MetricCard label="Heap Usage" value={`${data.memory.heapPercent}%`} icon="🧠"
          color={data.memory.heapPercent > 85 ? '#ff4757' : data.memory.heapPercent > 70 ? '#ffa502' : '#2ed573'} />
        <MetricCard label="DB Latency" value={`${data.database.latencyMs}ms`} icon="🗄️"
          color={data.database.latencyMs > 100 ? '#ff4757' : '#2ed573'} />
        <MetricCard label="Req/min (1h)" value={data.requests.requestsPerMinute} icon="📈" />
        <MetricCard label="Error Rate (1h)" value={`${data.requests.errorRate}%`} icon="🚨"
          color={data.requests.errorRate > 5 ? '#ff4757' : data.requests.errorRate > 1 ? '#ffa502' : '#2ed573'} />
        <MetricCard label="Failed Logins (24h)" value={data.failedLoginsLast24h} icon="🔐"
          color={data.failedLoginsLast24h > 20 ? '#ff4757' : '#2ed573'} />
      </div>

      {/* Memory + Request breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '2rem' }}>
        <div className="card">
          <h3>Memory</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <MiniStat label="Heap Used" value={data.memory.heapUsed} />
            <MiniStat label="Heap Total" value={data.memory.heapTotal} />
            <MiniStat label="RSS" value={data.memory.rss} />
            <MiniStat label="Heap %" value={`${data.memory.heapPercent}%`} />
          </div>
          <ProgressBar value={data.memory.heapPercent} />
        </div>

        <div className="card">
          <h3>Requests (Last Hour)</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <MiniStat label="Total" value={data.requests.totalRequests} />
            <MiniStat label="Errors" value={data.requests.totalErrors} />
            <MiniStat label="Avg Latency" value={`${data.requests.avgLatencyMs}ms`} />
            <MiniStat label="Max Latency" value={`${data.requests.maxLatencyMs}ms`} />
          </div>
        </div>
      </div>

      {/* Data counts */}
      <div className="card">
        <h3>Data Counts</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <MiniStat label="Users" value={data.counts.users} />
          <MiniStat label="Schools" value={data.counts.schools} />
          <MiniStat label="Sessions" value={data.counts.sessions} />
        </div>
      </div>
    </div>
  );
}

// ─── System Health (detailed) ────────────────────────────

function SystemHealth() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sreApi.getHealth().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading health data...</div>;
  if (!data) return <p>Failed to load health data</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div className="card">
        <h3>Process</h3>
        <DetailTable data={{
          'Status': data.status,
          'Uptime': data.process.uptimeFormatted,
          'PID': data.process.pid,
          'Node.js': data.process.nodeVersion,
          'Platform': data.process.platform,
          'Architecture': data.process.arch,
          'Environment': data.environment,
        }} />
      </div>

      <div className="card">
        <h3>Memory</h3>
        <DetailTable data={{
          'RSS': data.memory.rss,
          'Heap Used': data.memory.heapUsed,
          'Heap Total': data.memory.heapTotal,
          'External': data.memory.external,
          'Heap Usage': `${data.memory.heapUsagePercent}%`,
        }} />
        <ProgressBar value={data.memory.heapUsagePercent} />
      </div>

      <div className="card">
        <h3>Operating System</h3>
        <DetailTable data={{
          'Hostname': data.os.hostname,
          'OS': `${data.os.type} ${data.os.release}`,
          'Total Memory': data.os.totalMemory,
          'Free Memory': data.os.freeMemory,
          'Memory Usage': `${data.os.memoryUsagePercent}%`,
          'CPU Cores': data.os.cpuCores,
          'Load Average': data.os.loadAvg.map(v => v.toFixed(2)).join(', '),
        }} />
        <ProgressBar value={data.os.memoryUsagePercent} label="OS Memory" />
      </div>

      <div className="card">
        <h3>Database</h3>
        <DetailTable data={{
          'Status': data.database.healthy ? '✅ Healthy' : '❌ Unreachable',
          'Latency': `${data.database.latencyMs}ms`,
        }} />
      </div>
    </div>
  );
}

// ─── Database Metrics ────────────────────────────────────

function DatabaseMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sreApi.getDatabase().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading database metrics...</div>;
  if (!data) return <p>Failed to load database metrics</p>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard label="Database Size" value={data.databaseSize} icon="💾" />
        <MetricCard label="PostgreSQL" value={data.postgresVersion} icon="🐘" />
        <MetricCard label="Tables" value={data.tableCount} icon="📋" />
        <MetricCard label="Connections (Active)" value={data.connections.active} icon="🔗"
          color={data.connections.active > 20 ? '#ff4757' : '#2ed573'} />
        <MetricCard label="Connections (Total)" value={data.connections.total} icon="🔌" />
        <MetricCard label="Idle in Txn" value={data.connections.idleInTransaction} icon="⏳"
          color={data.connections.idleInTransaction > 5 ? '#ff4757' : '#2ed573'} />
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Table Sizes</h3>
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Table</th><th style={{ textAlign: 'right' }}>Rows</th><th style={{ textAlign: 'right' }}>Size</th></tr>
          </thead>
          <tbody>
            {data.tables.map(t => (
              <tr key={t.tableName}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{t.tableName}</td>
                <td style={{ textAlign: 'right' }}>{t.rowCount.toLocaleString()}</td>
                <td style={{ textAlign: 'right' }}>{t.totalSize}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data.slowQueries.length > 0 && (
        <div className="card">
          <h3>Slowest Queries</h3>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Query</th><th style={{ textAlign: 'right' }}>Calls</th><th style={{ textAlign: 'right' }}>Mean (ms)</th><th style={{ textAlign: 'right' }}>Max (ms)</th></tr>
            </thead>
            <tbody>
              {data.slowQueries.map((q, i) => (
                <tr key={i}>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.8rem', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</td>
                  <td style={{ textAlign: 'right' }}>{q.calls.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }}>{q.meanMs}</td>
                  <td style={{ textAlign: 'right' }}>{q.maxMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Request Metrics ─────────────────────────────────────

function RequestMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    try {
      const d = await sreApi.getRequests();
      setData(d);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetch]);

  if (loading) return <div className="loading">Loading request metrics...</div>;
  if (!data) return <p>Failed to load request metrics</p>;

  return (
    <div>
      {/* Window metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <MetricCard label="Total (1h)" value={data.window.totalRequests} icon="📊" />
        <MetricCard label="Errors (1h)" value={data.window.totalErrors} icon="🚨"
          color={data.window.totalErrors > 0 ? '#ff4757' : '#2ed573'} />
        <MetricCard label="Error Rate" value={`${data.window.errorRate}%`} icon="📉"
          color={data.window.errorRate > 5 ? '#ff4757' : '#2ed573'} />
        <MetricCard label="Avg Latency" value={`${data.window.avgLatencyMs}ms`} icon="⏱️" />
        <MetricCard label="Max Latency" value={`${data.window.maxLatencyMs}ms`} icon="🔴"
          color={data.window.maxLatencyMs > 1000 ? '#ff4757' : '#2ed573'} />
        <MetricCard label="Req/min" value={data.window.requestsPerMinute} icon="📈" />
      </div>

      {/* Lifetime */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Lifetime (Since Server Start)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
          <MiniStat label="Total Requests" value={data.lifetime.totalRequests.toLocaleString()} />
          <MiniStat label="Total Errors" value={data.lifetime.totalErrors.toLocaleString()} />
          <MiniStat label="Avg Latency" value={`${data.lifetime.avgLatencyMs}ms`} />
        </div>
      </div>

      {/* Status code breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <div className="card">
          <h3>Status Codes (1h)</h3>
          {Object.keys(data.statusCodes).length === 0 ? (
            <p style={{ color: '#8892a4' }}>No requests in the last hour</p>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead><tr><th>Code</th><th style={{ textAlign: 'right' }}>Count</th><th>Bar</th></tr></thead>
              <tbody>
                {Object.entries(data.statusCodes)
                  .sort((a, b) => b[1] - a[1])
                  .map(([code, count]) => {
                    const pct = data.window.totalRequests > 0 ? (count / data.window.totalRequests) * 100 : 0;
                    const color = code.startsWith('2') ? '#2ed573' : code.startsWith('4') ? '#ffa502' : code.startsWith('5') ? '#ff4757' : '#8892a4';
                    return (
                      <tr key={code}>
                        <td style={{ fontWeight: 700, color }}>{code}</td>
                        <td style={{ textAlign: 'right' }}>{count}</td>
                        <td><div style={{ background: color, height: 8, borderRadius: 4, width: `${Math.max(pct, 3)}%`, opacity: 0.8 }} /></td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Top Routes (1h)</h3>
          {data.topRoutes.length === 0 ? (
            <p style={{ color: '#8892a4' }}>No requests in the last hour</p>
          ) : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead><tr><th>Route</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
              <tbody>
                {data.topRoutes.map(r => (
                  <tr key={r.route}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.route}</td>
                    <td style={{ textAlign: 'right' }}>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="card">
        <h3>Request Timeline (per minute)</h3>
        {data.timeline.length === 0 ? (
          <p style={{ color: '#8892a4' }}>No data in the last hour</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '2px', height: '120px', padding: '0.5rem 0' }}>
              {data.timeline.map((t, i) => {
                const maxReq = Math.max(...data.timeline.map(x => x.requests), 1);
                const height = Math.max((t.requests / maxReq) * 100, 2);
                const hasErrors = t.errors > 0;
                return (
                  <div key={i} title={`${new Date(t.timestamp).toLocaleTimeString()}\n${t.requests} req, ${t.errors} err, ${t.avgLatency}ms`}
                    style={{
                      flex: 1, minWidth: 4, height: `${height}%`,
                      background: hasErrors ? '#ff4757' : '#e94560',
                      borderRadius: '2px 2px 0 0', cursor: 'pointer', opacity: 0.8,
                    }} />
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: '#8892a4' }}>
              <span>{data.timeline.length > 0 ? new Date(data.timeline[0].timestamp).toLocaleTimeString() : ''}</span>
              <span>{data.timeline.length > 0 ? new Date(data.timeline[data.timeline.length - 1].timestamp).toLocaleTimeString() : ''}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Error Logs ──────────────────────────────────────────

function ErrorLogs() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hours, setHours] = useState(24);

  useEffect(() => {
    setLoading(true);
    sreApi.getErrors({ hours, limit: 200 })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [hours]);

  if (loading) return <div className="loading">Loading error logs...</div>;
  if (!data) return <p>Failed to load error logs</p>;

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select value={hours} onChange={e => setHours(Number(e.target.value))}>
          <option value={1}>Last 1 hour</option>
          <option value={6}>Last 6 hours</option>
          <option value={24}>Last 24 hours</option>
          <option value={72}>Last 3 days</option>
          <option value={168}>Last 7 days</option>
        </select>
        <span style={{ fontSize: '0.85rem', color: '#8892a4' }}>{data.count} events since {new Date(data.since).toLocaleString()}</span>
      </div>

      {data.logs.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
          <span style={{ fontSize: '3rem' }}>✅</span>
          <p style={{ color: '#2ed573', fontWeight: 600, marginTop: '0.5rem' }}>No security events in this time window</p>
        </div>
      ) : (
        <table className="data-table" style={{ width: '100%' }}>
          <thead>
            <tr><th>Time</th><th>Action</th><th>Performer</th><th>Target</th><th>Details</th><th>IP</th></tr>
          </thead>
          <tbody>
            {data.logs.map(log => (
              <tr key={log.id}>
                <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                <td>
                  <span style={{
                    fontSize: '0.75rem', padding: '0.15rem 0.4rem', borderRadius: 4,
                    background: log.action === 'LOGIN_FAILED' ? '#ff475733' : '#ffa50233',
                    color: log.action === 'LOGIN_FAILED' ? '#ff4757' : '#ffa502',
                  }}>{log.action}</span>
                </td>
                <td style={{ fontSize: '0.85rem' }}>{log.performer ? `${log.performer.email}` : 'Unknown'}</td>
                <td style={{ fontSize: '0.85rem' }}>{log.targetType || '—'}</td>
                <td style={{ fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.details ? JSON.stringify(log.details) : '—'}
                </td>
                <td style={{ fontSize: '0.8rem', fontFamily: 'monospace' }}>{log.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Runtime Info ────────────────────────────────────────

function RuntimeInfo() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sreApi.getRuntime().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading runtime info...</div>;
  if (!data) return <p>Failed to load runtime info</p>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
      <div className="card">
        <h3>Application</h3>
        <DetailTable data={{
          'Name': data.app.name,
          'Version': data.app.version,
          'Environment': data.app.nodeEnv,
          'Started At': new Date(data.startedAt).toLocaleString(),
          'Uptime': `${Math.floor(data.uptimeSeconds / 3600)}h ${Math.floor((data.uptimeSeconds % 3600) / 60)}m`,
        }} />
      </div>

      <div className="card">
        <h3>Node.js</h3>
        <DetailTable data={{
          'Version': data.node.version,
          'V8 Engine': data.node.v8Version,
          'OpenSSL': data.node.opensslVersion,
        }} />
      </div>

      <div className="card" style={{ gridColumn: 'span 2' }}>
        <h3>Key Dependencies</h3>
        <table className="data-table" style={{ width: '100%' }}>
          <thead><tr><th>Package</th><th>Version</th></tr></thead>
          <tbody>
            {Object.entries(data.dependencies).filter(([_, v]) => v).map(([pkg, ver]) => (
              <tr key={pkg}>
                <td style={{ fontFamily: 'monospace' }}>{pkg}</td>
                <td>{ver}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Shared Components ───────────────────────────────────

function MetricCard({ label, value, icon, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
      <div style={{ fontSize: '1.75rem' }}>{icon}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: color || '#e94560', wordBreak: 'break-all' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#8892a4' }}>{label}</div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: '#8892a4', marginBottom: '0.15rem' }}>{label}</div>
      <div style={{ fontSize: '1.1rem', fontWeight: 600 }}>{value}</div>
    </div>
  );
}

function ProgressBar({ value, label }) {
  const color = value > 85 ? '#ff4757' : value > 70 ? '#ffa502' : '#2ed573';
  return (
    <div style={{ marginTop: '0.75rem' }}>
      {label && <div style={{ fontSize: '0.75rem', color: '#8892a4', marginBottom: '0.25rem' }}>{label}</div>}
      <div style={{ background: '#1a1a2e', borderRadius: 6, height: 10, overflow: 'hidden' }}>
        <div style={{ background: color, height: '100%', width: `${Math.min(value, 100)}%`, borderRadius: 6, transition: 'width 0.5s ease' }} />
      </div>
    </div>
  );
}

function DetailTable({ data }) {
  return (
    <table style={{ width: '100%', borderSpacing: '0' }}>
      <tbody>
        {Object.entries(data).map(([k, v]) => (
          <tr key={k}>
            <td style={{ padding: '0.35rem 0', color: '#8892a4', fontSize: '0.85rem', width: '40%' }}>{k}</td>
            <td style={{ padding: '0.35rem 0', fontWeight: 500, fontSize: '0.9rem' }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
