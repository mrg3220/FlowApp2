import { useState, useEffect } from 'react';
import { virtualApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const CONTENT_ICONS = { VIDEO: '🎥', DOCUMENT: '📄', LINK: '🔗' };

export default function VirtualClassesPage() {
  const { user } = useAuth();
  const isStaff = user && !['STUDENT'].includes(user.role);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [content, setContent] = useState([]);
  const [selected, setSelected] = useState(null);
  const [myViews, setMyViews] = useState([]);
  const [stats, setStats] = useState(null);
  const [tab, setTab] = useState('CONTENT');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', contentType: 'VIDEO', url: '', thumbnailUrl: '', duration: '', isPublic: true });

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    loadContent();
    virtualApi.getMyViews().then(setMyViews).catch(() => setMyViews([]));
    if (isStaff) virtualApi.getStats(schoolId).then(setStats).catch(() => setStats(null));
  }, [schoolId]);

  const loadContent = () => virtualApi.getBySchool(schoolId).then(setContent);

  const handleSave = async (e) => {
    e.preventDefault();
    const data = { ...form, duration: form.duration ? Number(form.duration) : null };
    if (editItem) {
      await virtualApi.update(editItem.id, data);
    } else {
      await virtualApi.create(schoolId, data);
    }
    setShowForm(false);
    setEditItem(null);
    setForm({ title: '', description: '', contentType: 'VIDEO', url: '', thumbnailUrl: '', duration: '', isPublic: true });
    loadContent();
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this content?')) return;
    await virtualApi.delete(id);
    if (selected?.id === id) setSelected(null);
    loadContent();
  };

  const handleWatch = async (item) => {
    const detail = await virtualApi.getById(item.id);
    setSelected(detail);
    // Record view
    virtualApi.recordView(item.id, { watchedSeconds: 0 }).catch(() => {});
  };

  const handleCompleteView = async () => {
    if (!selected) return;
    await virtualApi.recordView(selected.id, { watchedSeconds: selected.duration || 0, completed: true });
    virtualApi.getMyViews().then(setMyViews).catch(() => {});
    alert('Marked as complete!');
  };

  return (
    <div className="page">
      <h1>📺 Virtual Classes & Content</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'CONTENT' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('CONTENT')}>Library</button>
        <button className={`btn ${tab === 'MY' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('MY')}>My Progress</button>
        {isStaff && <button className={`btn ${tab === 'STATS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('STATS')}>Stats</button>}
        {isStaff && <button className="btn btn-primary" onClick={() => { setShowForm(!showForm); setEditItem(null); setForm({ title: '', description: '', contentType: 'VIDEO', url: '', thumbnailUrl: '', duration: '', isPublic: true }); }}>+ Add Content</button>}
      </div>

      {showForm && isStaff && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>{editItem ? 'Edit' : 'New'} Content</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Title *" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <select className="form-input" value={form.contentType} onChange={(e) => setForm({ ...form, contentType: e.target.value })}>
              <option value="VIDEO">🎥 Video</option>
              <option value="DOCUMENT">📄 Document</option>
              <option value="LINK">🔗 Link</option>
            </select>
            <input className="form-input" placeholder="Content URL *" required value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
            <input className="form-input" placeholder="Thumbnail URL" value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} />
            <input className="form-input" type="number" placeholder="Duration (seconds)" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
          </div>
          <textarea className="form-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: '0.5rem' }} />
          <label style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}><input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Visible to Students</label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === 'STATS' && isStaff && stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: '4px solid #3b82f6' }}>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Total Views</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.totalViews || 0}</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: '4px solid #22c55e' }}>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Completed</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{stats.completedViews || 0}</div>
          </div>
          <div className="card" style={{ padding: '1rem', textAlign: 'center', borderTop: '4px solid #f59e0b' }}>
            <div style={{ fontSize: '0.85rem', color: '#888' }}>Avg Watch Time</div>
            <div style={{ fontSize: '2rem', fontWeight: 700 }}>{Math.round(stats.avgWatchSeconds || 0)}s</div>
          </div>
        </div>
      )}

      {tab === 'CONTENT' && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 2 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
              {content.map((item) => {
                const viewed = myViews.find((v) => v.contentId === item.id);
                return (
                  <div key={item.id} className="card" style={{ padding: '0', overflow: 'hidden', cursor: 'pointer', border: selected?.id === item.id ? '2px solid #3b82f6' : '1px solid #eee' }}
                    onClick={() => handleWatch(item)}>
                    <div style={{ height: '160px', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ fontSize: '3rem' }}>{CONTENT_ICONS[item.contentType]}</span>
                      )}
                      {viewed?.completed && <div style={{ position: 'absolute', top: '8px', right: '8px', background: '#22c55e', color: '#fff', borderRadius: '50%', width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✓</div>}
                    </div>
                    <div style={{ padding: '0.75rem' }}>
                      <h3 style={{ margin: '0 0 0.25rem', fontSize: '1rem' }}>{item.title}</h3>
                      <div style={{ fontSize: '0.8rem', color: '#888' }}>
                        {CONTENT_ICONS[item.contentType]} {item.contentType}
                        {item.duration && ` · ${Math.floor(item.duration / 60)}:${(item.duration % 60).toString().padStart(2, '0')}`}
                      </div>
                      <p style={{ fontSize: '0.8rem', color: '#666', margin: '0.3rem 0 0' }}>{item.description?.slice(0, 80)}</p>
                    </div>
                  </div>
                );
              })}
              {content.length === 0 && <p style={{ color: '#888' }}>No content available</p>}
            </div>
          </div>

          {selected && (
            <div className="card" style={{ padding: '1rem', flex: 1, maxHeight: '80vh', overflowY: 'auto' }}>
              <h2>{selected.title}</h2>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                {CONTENT_ICONS[selected.contentType]} {selected.contentType}
                {selected.duration && ` · ${Math.floor(selected.duration / 60)}:${(selected.duration % 60).toString().padStart(2, '0')}`}
              </div>

              {selected.contentType === 'VIDEO' && selected.url && (
                <div style={{ marginBottom: '1rem' }}>
                  {selected.url.includes('youtube') || selected.url.includes('youtu.be') ? (
                    <iframe src={selected.url.replace('watch?v=', 'embed/')} width="100%" height="220" frameBorder="0" allowFullScreen style={{ borderRadius: '8px' }} />
                  ) : (
                    <video src={selected.url} controls width="100%" style={{ borderRadius: '8px' }} />
                  )}
                </div>
              )}
              {selected.contentType === 'DOCUMENT' && selected.url && (
                <a href={selected.url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ marginBottom: '1rem', display: 'inline-block' }}>📄 Open Document</a>
              )}
              {selected.contentType === 'LINK' && selected.url && (
                <a href={selected.url} target="_blank" rel="noreferrer" className="btn btn-outline" style={{ marginBottom: '1rem', display: 'inline-block' }}>🔗 Open Link</a>
              )}

              {selected.description && <p>{selected.description}</p>}

              <button className="btn btn-primary" onClick={handleCompleteView}>✓ Mark Complete</button>

              {isStaff && (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  <button className="btn btn-outline" onClick={() => { setEditItem(selected); setForm({ title: selected.title, description: selected.description || '', contentType: selected.contentType, url: selected.url, thumbnailUrl: selected.thumbnailUrl || '', duration: selected.duration || '', isPublic: selected.isPublic }); setShowForm(true); }}>Edit</button>
                  <button className="btn btn-outline" style={{ color: '#ef4444' }} onClick={() => handleDelete(selected.id)}>Delete</button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {tab === 'MY' && (
        <div className="card" style={{ padding: '1rem' }}>
          <h3>My Viewing Progress</h3>
          <table className="data-table">
            <thead><tr><th>Content</th><th>Type</th><th>Watched</th><th>Status</th><th>Last Viewed</th></tr></thead>
            <tbody>
              {myViews.map((v) => (
                <tr key={v.id}>
                  <td><strong>{v.content?.title}</strong></td>
                  <td>{CONTENT_ICONS[v.content?.contentType]} {v.content?.contentType}</td>
                  <td>{v.watchedSeconds ? `${Math.floor(v.watchedSeconds / 60)}:${(v.watchedSeconds % 60).toString().padStart(2, '0')}` : '—'}</td>
                  <td>{v.completed ? <span style={{ color: '#22c55e', fontWeight: 600 }}>✓ Complete</span> : <span style={{ color: '#f59e0b' }}>In Progress</span>}</td>
                  <td>{new Date(v.lastViewedAt || v.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
              {myViews.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>No viewing history</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
