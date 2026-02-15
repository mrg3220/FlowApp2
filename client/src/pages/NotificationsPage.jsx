import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { notificationApi, schoolApi } from '../api/client';

const NOTIFICATION_TYPES = [
  'WELCOME','BIRTHDAY','MISSED_CLASS','PAYMENT_REMINDER','PAYMENT_RECEIPT',
  'CLASS_CHANGE','CLASS_CANCELLED','PROMOTION','TEST_SCHEDULED','INVOICE_CREATED','GENERAL',
];
const CHANNELS = ['EMAIL', 'SMS', 'IN_APP'];

const TABS = {
  INBOX: 'Inbox',
  PREFERENCES: 'Preferences',
  TEMPLATES: 'Templates',
  LOG: 'Log',
  SEND: 'Send',
};

export default function NotificationsPage() {
  const { isSuperAdmin, isOwner, isStaff } = useAuth();
  const [tab, setTab] = useState('INBOX');

  const staffTabs = isStaff
    ? ['INBOX', 'PREFERENCES', 'TEMPLATES', 'LOG', 'SEND']
    : ['INBOX', 'PREFERENCES'];

  return (
    <div className="page notifications-page">
      <h1>🔔 Notifications</h1>
      <div className="tab-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {staffTabs.map((t) => (
          <button key={t} className={`btn ${tab === t ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(t)}>
            {TABS[t]}
          </button>
        ))}
      </div>

      {tab === 'INBOX' && <InboxTab />}
      {tab === 'PREFERENCES' && <PreferencesTab />}
      {tab === 'TEMPLATES' && isStaff && <TemplatesTab />}
      {tab === 'LOG' && isStaff && <LogTab />}
      {tab === 'SEND' && (isSuperAdmin || isOwner) && <SendTab />}
    </div>
  );
}

// ─── Inbox ───────────────────────────────────────────────

function InboxTab() {
  const [data, setData] = useState({ notifications: [], total: 0, unread: 0 });
  const [page, setPage] = useState(1);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationApi.getMine({ page, limit: 20, unreadOnly });
      setData(res);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [page, unreadOnly]);

  useEffect(() => { load(); }, [load]);

  const handleMarkAll = async () => {
    await notificationApi.markRead('all');
    load();
  };

  const handleMarkRead = async (ids) => {
    await notificationApi.markRead(ids);
    load();
  };

  if (loading) return <p>Loading notifications…</p>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <span style={{ fontWeight: 600 }}>{data.unread} unread</span>
          <label style={{ fontSize: '0.85rem' }}>
            <input type="checkbox" checked={unreadOnly} onChange={(e) => { setUnreadOnly(e.target.checked); setPage(1); }} />
            {' '}Unread only
          </label>
        </div>
        {data.unread > 0 && (
          <button className="btn btn-sm btn-outline" onClick={handleMarkAll}>Mark all read</button>
        )}
      </div>

      {data.notifications.length === 0 ? (
        <p style={{ color: '#888' }}>No notifications.</p>
      ) : (
        <div className="notifications-list" style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {data.notifications.map((n) => (
            <div
              key={n.id}
              style={{
                padding: '0.75rem 1rem',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                background: n.readAt ? '#fff' : '#eef6ff',
                cursor: n.readAt ? 'default' : 'pointer',
              }}
              onClick={() => !n.readAt && handleMarkRead([n.id])}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#888' }}>
                <span>{n.type.replace(/_/g, ' ')} • {n.channel}</span>
                <span>{new Date(n.createdAt).toLocaleString()}</span>
              </div>
              {n.subject && <div style={{ fontWeight: 600, marginTop: '0.25rem' }}>{n.subject}</div>}
              <div style={{ marginTop: '0.25rem' }}>{n.body}</div>
            </div>
          ))}
        </div>
      )}

      {data.total > 20 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span style={{ padding: '0.25rem 0.5rem' }}>Page {page} of {Math.ceil(data.total / 20)}</span>
          <button className="btn btn-sm btn-outline" disabled={page >= Math.ceil(data.total / 20)} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Preferences ─────────────────────────────────────────

function PreferencesTab() {
  const [prefs, setPrefs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    notificationApi.getPreferences().then(setPrefs).finally(() => setLoading(false));
  }, []);

  const toggle = async (type, channel) => {
    const existing = prefs.find((p) => p.type === type && p.channel === channel);
    const enabled = existing ? !existing.enabled : false;
    const updated = await notificationApi.updatePreference(type, channel, enabled);
    setPrefs((prev) => {
      const idx = prev.findIndex((p) => p.type === type && p.channel === channel);
      if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
      return [...prev, updated];
    });
  };

  const isEnabled = (type, channel) => {
    const p = prefs.find((p) => p.type === type && p.channel === channel);
    return p ? p.enabled : true; // default enabled
  };

  if (loading) return <p>Loading preferences…</p>;

  return (
    <div style={{ overflowX: 'auto' }}>
      <p style={{ color: '#666', marginBottom: '1rem' }}>Choose which notifications you receive and how.</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>Notification Type</th>
            {CHANNELS.map((c) => <th key={c}>{c.replace('_', ' ')}</th>)}
          </tr>
        </thead>
        <tbody>
          {NOTIFICATION_TYPES.map((type) => (
            <tr key={type}>
              <td>{type.replace(/_/g, ' ')}</td>
              {CHANNELS.map((ch) => (
                <td key={ch} style={{ textAlign: 'center' }}>
                  <input
                    type="checkbox"
                    checked={isEnabled(type, ch)}
                    onChange={() => toggle(type, ch)}
                    style={{ width: 18, height: 18, cursor: 'pointer' }}
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Templates (Staff) ──────────────────────────────────

function TemplatesTab() {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [templates, setTemplates] = useState([]);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({ type: 'GENERAL', channel: 'EMAIL', subject: '', body: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((data) => {
      const list = data.schools || data;
      setSchools(list);
      if (list.length > 0) setSelectedSchool(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedSchool) return;
    setLoading(true);
    notificationApi.getTemplates(selectedSchool).then(setTemplates).finally(() => setLoading(false));
  }, [selectedSchool]);

  const handleSave = async () => {
    await notificationApi.upsertTemplate(selectedSchool, form);
    const updated = await notificationApi.getTemplates(selectedSchool);
    setTemplates(updated);
    setEditing(null);
    setForm({ type: 'GENERAL', channel: 'EMAIL', subject: '', body: '' });
  };

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label>School: </label>
        <select value={selectedSchool} onChange={(e) => setSelectedSchool(e.target.value)} className="form-input" style={{ display: 'inline', width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {!editing && (
        <button className="btn btn-primary btn-sm" style={{ marginBottom: '1rem' }} onClick={() => setEditing('new')}>
          + New Template
        </button>
      )}

      {editing && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>{editing === 'new' ? 'New Template' : 'Edit Template'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select className="form-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <input className="form-input" placeholder="Subject (optional)" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} style={{ marginBottom: '0.5rem' }} />
          <textarea className="form-input" placeholder="Body — use {{firstName}}, {{lastName}}, etc." value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} style={{ marginBottom: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn btn-primary btn-sm" onClick={handleSave}>Save</button>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}

      {loading ? <p>Loading templates…</p> : (
        <table className="data-table">
          <thead><tr><th>Type</th><th>Channel</th><th>Subject</th><th>Active</th><th>Actions</th></tr></thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id}>
                <td>{t.type}</td>
                <td>{t.channel}</td>
                <td>{t.subject || '—'}</td>
                <td>{t.isActive ? '✅' : '❌'}</td>
                <td>
                  <button className="btn btn-sm btn-outline" onClick={() => {
                    setEditing(t.id);
                    setForm({ type: t.type, channel: t.channel, subject: t.subject || '', body: t.body });
                  }}>Edit</button>
                </td>
              </tr>
            ))}
            {templates.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No templates yet</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Log (Staff) ─────────────────────────────────────────

function LogTab() {
  const [schools, setSchools] = useState([]);
  const [selectedSchool, setSelectedSchool] = useState('');
  const [data, setData] = useState({ notifications: [], total: 0 });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((d) => {
      const list = d.schools || d;
      setSchools(list);
      if (list.length > 0) setSelectedSchool(list[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedSchool) return;
    setLoading(true);
    notificationApi.getSchoolLog(selectedSchool, { page, limit: 30 }).then(setData).finally(() => setLoading(false));
  }, [selectedSchool, page]);

  return (
    <div>
      <div style={{ marginBottom: '1rem' }}>
        <label>School: </label>
        <select value={selectedSchool} onChange={(e) => { setSelectedSchool(e.target.value); setPage(1); }} className="form-input" style={{ display: 'inline', width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {loading ? <p>Loading…</p> : (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Student</th><th>Type</th><th>Channel</th><th>Subject</th></tr></thead>
          <tbody>
            {data.notifications.map((n) => (
              <tr key={n.id}>
                <td>{new Date(n.createdAt).toLocaleString()}</td>
                <td>{n.user?.firstName} {n.user?.lastName}</td>
                <td>{n.type}</td>
                <td>{n.channel}</td>
                <td>{n.subject || n.body?.slice(0, 50)}</td>
              </tr>
            ))}
            {data.notifications.length === 0 && <tr><td colSpan="5" style={{ textAlign: 'center', color: '#888' }}>No notifications sent yet</td></tr>}
          </tbody>
        </table>
      )}

      {data.total > 30 && (
        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
          <button className="btn btn-sm btn-outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
          <span>Page {page}</span>
          <button className="btn btn-sm btn-outline" disabled={page * 30 >= data.total} onClick={() => setPage(page + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

// ─── Send (Staff) ────────────────────────────────────────

function SendTab() {
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState({ schoolId: '', userId: 'all_students', type: 'GENERAL', channel: 'IN_APP', subject: '', body: '' });
  const [status, setStatus] = useState('');

  useEffect(() => {
    schoolApi.getAll().then((d) => {
      const list = d.schools || d;
      setSchools(list);
      if (list.length > 0) setForm((f) => ({ ...f, schoolId: list[0].id }));
    });
  }, []);

  const handleSend = async () => {
    setStatus('Sending…');
    try {
      const res = await notificationApi.send(form);
      setStatus(`✅ Sent${res.sent ? ` to ${res.sent} students` : ''}`);
    } catch (e) {
      setStatus('❌ ' + e.message);
    }
  };

  return (
    <div className="card" style={{ padding: '1.5rem', maxWidth: '600px' }}>
      <h3>Send Notification</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label>School</label>
          <select className="form-input" value={form.schoolId} onChange={(e) => setForm({ ...form, schoolId: e.target.value })}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div>
          <label>To</label>
          <input className="form-input" value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })} placeholder="all_students or user ID" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
          <div>
            <label>Type</label>
            <select className="form-input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              {NOTIFICATION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label>Channel</label>
            <select className="form-input" value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              {CHANNELS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label>Subject (optional)</label>
          <input className="form-input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        </div>
        <div>
          <label>Body</label>
          <textarea className="form-input" rows={4} value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} placeholder="Use {{firstName}}, {{lastName}} for personalization" />
        </div>
        <button className="btn btn-primary" onClick={handleSend}>Send Notification</button>
        {status && <p style={{ marginTop: '0.5rem' }}>{status}</p>}
      </div>
    </div>
  );
}
