import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { adminApi } from '../api/client';

const ROLES = ['SUPER_ADMIN','OWNER','INSTRUCTOR','STUDENT','EVENT_COORDINATOR','MARKETING','SCHOOL_STAFF','IT_ADMIN'];
const AUDIT_ACTIONS = ['USER_CREATED','USER_UPDATED','USER_DISABLED','USER_ENABLED','USER_ROLE_CHANGED',
  'USER_PASSWORD_RESET','SESSION_REVOKED','SETTING_CHANGED','LOGIN_SUCCESS','LOGIN_FAILED','SYSTEM_CONFIG_CHANGED'];

export default function ITAdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState('users');

  return (
    <div>
      <h1>🔧 IT Administration</h1>
      <p style={{ color: '#8892a4', marginBottom: '1rem' }}>
        Manage users, permissions, audit logs, and system settings
      </p>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {[
          { key: 'dashboard', label: '📊 Dashboard' },
          { key: 'users', label: '👥 Users' },
          { key: 'audit', label: '📋 Audit Logs' },
          { key: 'settings', label: '⚙️ Settings' },
        ].map(t => (
          <button key={t.key} className={`btn ${tab === t.key ? 'btn-primary' : 'btn-outline'} btn-sm`}
            onClick={() => setTab(t.key)}>{t.label}</button>
        ))}
      </div>

      {tab === 'dashboard' && <AdminDashboard />}
      {tab === 'users' && <UserManagement />}
      {tab === 'audit' && <AuditLogs />}
      {tab === 'settings' && <SystemSettings />}
    </div>
  );
}

// ─── Admin Dashboard ─────────────────────────────────────

function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi.getStats().then(setStats).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading stats...</div>;
  if (!stats) return <p>Failed to load stats</p>;

  return (
    <div>
      <div className="stats-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <StatCard label="Total Users" value={stats.totalUsers} icon="👥" />
        <StatCard label="Active Users" value={stats.activeUsers} icon="✅" color="#2ed573" />
        <StatCard label="Disabled Users" value={stats.disabledUsers} icon="🚫" color="#ff4757" />
        <StatCard label="Schools" value={stats.schoolCount} icon="🏫" />
        <StatCard label="Audit Events (24h)" value={stats.auditEventsLast24h} icon="📋" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <h3>Role Breakdown</h3>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>Role</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
            <tbody>
              {Object.entries(stats.roleBreakdown || {}).map(([role, count]) => (
                <tr key={role}><td><span className="badge">{role}</span></td><td style={{ textAlign: 'right' }}>{count}</td></tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h3>Recent Users (7 days)</h3>
          {stats.recentUsers?.length === 0 ? <p style={{ color: '#8892a4' }}>No new users</p> : (
            <table className="data-table" style={{ width: '100%' }}>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Created</th></tr></thead>
              <tbody>
                {stats.recentUsers?.map(u => (
                  <tr key={u.id}>
                    <td>{u.firstName} {u.lastName}</td>
                    <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                    <td><span className="badge">{u.role}</span></td>
                    <td style={{ fontSize: '0.85rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '1.25rem' }}>
      <div style={{ fontSize: '2rem' }}>{icon}</div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: color || '#e94560' }}>{value}</div>
      <div style={{ fontSize: '0.85rem', color: '#8892a4' }}>{label}</div>
    </div>
  );
}

// ─── User Management ─────────────────────────────────────

function UserManagement() {
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [msg, setMsg] = useState('');

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      if (activeFilter) params.isActive = activeFilter;
      const data = await adminApi.getUsers(params);
      setUsers(data.users);
      setTotal(data.total);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, [page, search, roleFilter, activeFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await adminApi.changeRole(userId, newRole);
      setMsg('Role updated');
      fetchUsers();
    } catch (err) { setMsg(err.message); }
  };

  const handleToggleActive = async (u) => {
    try {
      if (u.isActive) {
        await adminApi.disableUser(u.id, 'Disabled by IT Admin');
      } else {
        await adminApi.enableUser(u.id);
      }
      setMsg(u.isActive ? 'User disabled' : 'User enabled');
      fetchUsers();
    } catch (err) { setMsg(err.message); }
  };

  const handleResetPassword = async (userId) => {
    const pw = prompt('Enter new password (min 8 chars):');
    if (!pw || pw.length < 8) return alert('Password must be at least 8 characters');
    try {
      await adminApi.resetPassword(userId, pw);
      setMsg('Password reset successfully');
    } catch (err) { setMsg(err.message); }
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div>
      {msg && <div className="alert" style={{ marginBottom: '1rem', padding: '0.75rem', background: '#1a1a2e', border: '1px solid #e94560', borderRadius: '8px' }}>{msg}
        <button style={{ float: 'right', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setMsg('')}>✕</button></div>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input type="text" placeholder="Search name or email..." value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          style={{ flex: 1, minWidth: '200px' }} />
        <select value={roleFilter} onChange={e => { setRoleFilter(e.target.value); setPage(1); }}>
          <option value="">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select value={activeFilter} onChange={e => { setActiveFilter(e.target.value); setPage(1); }}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Disabled</option>
        </select>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Create User</button>
      </div>

      {showCreate && <CreateUserForm onDone={() => { setShowCreate(false); fetchUsers(); }} onCancel={() => setShowCreate(false)} />}

      {loading ? <div className="loading">Loading users...</div> : (
        <>
          <div style={{ fontSize: '0.85rem', color: '#8892a4', marginBottom: '0.5rem' }}>{total} users found</div>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>School</th><th>Created</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                  <td>{u.firstName} {u.lastName}</td>
                  <td style={{ fontSize: '0.85rem' }}>{u.email}</td>
                  <td>
                    <select value={u.role} onChange={e => handleRoleChange(u.id, e.target.value)}
                      style={{ fontSize: '0.8rem', padding: '0.2rem' }}>
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span style={{ color: u.isActive ? '#2ed573' : '#ff4757', fontWeight: 600, fontSize: '0.85rem' }}>
                      {u.isActive ? '● Active' : '● Disabled'}
                    </span>
                  </td>
                  <td style={{ fontSize: '0.85rem' }}>{u.school?.name || '—'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.25rem' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => handleToggleActive(u)}
                        title={u.isActive ? 'Disable' : 'Enable'}>{u.isActive ? '🔒' : '🔓'}</button>
                      <button className="btn btn-outline btn-sm" onClick={() => handleResetPassword(u.id)}
                        title="Reset Password">🔑</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Create User Form ────────────────────────────────────

function CreateUserForm({ onDone, onCancel }) {
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', role: 'STUDENT', schoolId: '' });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await adminApi.createUser(form);
      onDone();
    } catch (err) { setError(err.message); }
    setSaving(false);
  };

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3>Create New User</h3>
      {error && <div style={{ color: '#ff4757', marginBottom: '0.5rem' }}>{error}</div>}
      <form onSubmit={handleSubmit} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        <input placeholder="First Name" required value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} />
        <input placeholder="Last Name" required value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} />
        <input type="email" placeholder="Email" required value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
        <input type="password" placeholder="Password (min 8)" required minLength={8} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
        <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <input placeholder="School ID (optional)" value={form.schoolId} onChange={e => setForm({ ...form, schoolId: e.target.value })} />
        <div style={{ gridColumn: 'span 2', display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
          <button type="button" className="btn btn-outline btn-sm" onClick={onCancel}>Cancel</button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>{saving ? 'Creating...' : 'Create User'}</button>
        </div>
      </form>
    </div>
  );
}

// ─── Audit Logs ──────────────────────────────────────────

function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 30 };
    if (actionFilter) params.action = actionFilter;
    adminApi.getAuditLogs(params)
      .then(data => { setLogs(data.logs); setTotal(data.total); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, actionFilter]);

  const totalPages = Math.ceil(total / 30);

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', alignItems: 'center' }}>
        <select value={actionFilter} onChange={e => { setActionFilter(e.target.value); setPage(1); }}>
          <option value="">All Actions</option>
          {AUDIT_ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
        <span style={{ fontSize: '0.85rem', color: '#8892a4' }}>{total} log entries</span>
      </div>

      {loading ? <div className="loading">Loading audit logs...</div> : (
        <>
          <table className="data-table" style={{ width: '100%' }}>
            <thead>
              <tr><th>Time</th><th>Action</th><th>Performer</th><th>Target</th><th>Details</th><th>IP</th></tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id}>
                  <td style={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>{new Date(log.createdAt).toLocaleString()}</td>
                  <td><span className="badge" style={{ fontSize: '0.75rem' }}>{log.action}</span></td>
                  <td style={{ fontSize: '0.85rem' }}>{log.performer ? `${log.performer.firstName} ${log.performer.lastName}` : 'System'}</td>
                  <td style={{ fontSize: '0.85rem' }}>{log.targetType} {log.targetId ? `(${log.targetId.slice(0, 8)}…)` : ''}</td>
                  <td style={{ fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {log.details ? JSON.stringify(log.details) : '—'}
                  </td>
                  <td style={{ fontSize: '0.8rem' }}>{log.ipAddress || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1rem' }}>
              <button className="btn btn-outline btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
              <span style={{ padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}>Page {page} of {totalPages}</span>
              <button className="btn btn-outline btn-sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next →</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── System Settings ─────────────────────────────────────

function SystemSettings() {
  const [settings, setSettings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [msg, setMsg] = useState('');

  const fetchSettings = useCallback(async () => {
    try {
      const data = await adminApi.getSettings();
      setSettings(data);
    } catch (err) { console.error(err); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleUpdate = async (key, value) => {
    try {
      await adminApi.upsertSetting(key, { value });
      setMsg(`Setting "${key}" updated`);
      fetchSettings();
    } catch (err) { setMsg(err.message); }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!newKey || !newValue) return;
    try {
      await adminApi.upsertSetting(newKey, { value: newValue, category: newCategory });
      setMsg(`Setting "${newKey}" created`);
      setNewKey(''); setNewValue(''); setNewCategory('general');
      fetchSettings();
    } catch (err) { setMsg(err.message); }
  };

  if (loading) return <div className="loading">Loading settings...</div>;

  const categories = [...new Set(settings.map(s => s.category))];

  return (
    <div>
      {msg && <div className="alert" style={{ marginBottom: '1rem', padding: '0.75rem', background: '#1a1a2e', border: '1px solid #e94560', borderRadius: '8px' }}>{msg}
        <button style={{ float: 'right', background: 'none', border: 'none', color: '#fff', cursor: 'pointer' }} onClick={() => setMsg('')}>✕</button></div>}

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Add Setting</h3>
        <form onSubmit={handleAdd} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input placeholder="Key" value={newKey} onChange={e => setNewKey(e.target.value)} required style={{ flex: 1, minWidth: '150px' }} />
          <input placeholder="Value" value={newValue} onChange={e => setNewValue(e.target.value)} required style={{ flex: 2, minWidth: '200px' }} />
          <input placeholder="Category" value={newCategory} onChange={e => setNewCategory(e.target.value)} style={{ width: '120px' }} />
          <button type="submit" className="btn btn-primary btn-sm">Add</button>
        </form>
      </div>

      {categories.map(cat => (
        <div key={cat} style={{ marginBottom: '1.5rem' }}>
          <h3 style={{ textTransform: 'capitalize', marginBottom: '0.5rem' }}>{cat}</h3>
          <table className="data-table" style={{ width: '100%' }}>
            <thead><tr><th>Key</th><th>Value</th><th>Updated</th><th>Action</th></tr></thead>
            <tbody>
              {settings.filter(s => s.category === cat).map(s => (
                <SettingRow key={s.id} setting={s} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {settings.length === 0 && <p style={{ color: '#8892a4' }}>No system settings configured yet.</p>}
    </div>
  );
}

function SettingRow({ setting, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(setting.value);

  const save = () => { onUpdate(setting.key, val); setEditing(false); };

  return (
    <tr>
      <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{setting.key}</td>
      <td>
        {editing ? (
          <input value={val} onChange={e => setVal(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }} />
        ) : (
          <span style={{ fontSize: '0.85rem' }}>{setting.value}</span>
        )}
      </td>
      <td style={{ fontSize: '0.8rem' }}>{new Date(setting.updatedAt).toLocaleString()}</td>
      <td>
        {editing ? (
          <div style={{ display: 'flex', gap: '0.25rem' }}>
            <button className="btn btn-primary btn-sm" onClick={save}>Save</button>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        ) : (
          <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>
        )}
      </td>
    </tr>
  );
}
