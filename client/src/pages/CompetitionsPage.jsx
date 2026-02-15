import { useState, useEffect } from 'react';
import { competitionApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

const MEDAL_COLORS = { GOLD: '#fbbf24', SILVER: '#9ca3af', BRONZE: '#d97706', NONE: '#e5e7eb' };
const MEDAL_ICONS = { GOLD: '🥇', SILVER: '🥈', BRONZE: '🥉', NONE: '—' };

export default function CompetitionsPage() {
  const { user } = useAuth();
  const isStaff = user && !['STUDENT'].includes(user.role);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [competitions, setCompetitions] = useState([]);
  const [selected, setSelected] = useState(null);
  const [medalStats, setMedalStats] = useState([]);
  const [tab, setTab] = useState('LIST');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', date: '', location: '', description: '' });
  const [entryForm, setEntryForm] = useState({ userId: '', weightClass: '', division: '', medalType: 'NONE', placement: '', notes: '' });
  const [showEntryForm, setShowEntryForm] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    loadCompetitions();
    competitionApi.getMedalStats(schoolId).then(setMedalStats).catch(() => setMedalStats([]));
  }, [schoolId]);

  const loadCompetitions = () => competitionApi.getBySchool(schoolId).then(setCompetitions);

  const loadCompetition = async (id) => {
    const comp = await competitionApi.getById(id);
    setSelected(comp);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    await competitionApi.create(schoolId, { ...form, date: new Date(form.date).toISOString() });
    setShowForm(false);
    setForm({ name: '', date: '', location: '', description: '' });
    loadCompetitions();
  };

  const handleDeleteComp = async (id) => {
    if (!confirm('Delete competition?')) return;
    await competitionApi.delete(id);
    if (selected?.id === id) setSelected(null);
    loadCompetitions();
  };

  const handleAddEntry = async (e) => {
    e.preventDefault();
    await competitionApi.addEntry(selected.id, {
      ...entryForm,
      placement: entryForm.placement ? Number(entryForm.placement) : null,
    });
    setShowEntryForm(false);
    setEntryForm({ userId: '', weightClass: '', division: '', medalType: 'NONE', placement: '', notes: '' });
    loadCompetition(selected.id);
    competitionApi.getMedalStats(schoolId).then(setMedalStats).catch(() => {});
  };

  const handleDeleteEntry = async (entryId) => {
    await competitionApi.deleteEntry(selected.id, entryId);
    loadCompetition(selected.id);
  };

  return (
    <div className="page">
      <h1>🏆 Competitions & Tournaments</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'LIST' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('LIST')}>Events</button>
        <button className={`btn ${tab === 'MEDALS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('MEDALS')}>Medal Board</button>
        {isStaff && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Event</button>}
      </div>

      {showForm && isStaff && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>New Competition</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Event Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="form-input" type="date" required value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <input className="form-input" placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
          </div>
          <textarea className="form-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: '0.5rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Create</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === 'MEDALS' && (
        <div className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>Medal Board</h3>
          <table className="data-table">
            <thead><tr><th>Student</th><th>🥇 Gold</th><th>🥈 Silver</th><th>🥉 Bronze</th><th>Events</th></tr></thead>
            <tbody>
              {medalStats.map((s) => (
                <tr key={s.userId}>
                  <td><strong>{s.firstName} {s.lastName}</strong></td>
                  <td style={{ fontWeight: 700, color: '#fbbf24' }}>{s.gold}</td>
                  <td style={{ fontWeight: 700, color: '#9ca3af' }}>{s.silver}</td>
                  <td style={{ fontWeight: 700, color: '#d97706' }}>{s.bronze}</td>
                  <td>{s.totalEvents}</td>
                </tr>
              ))}
              {medalStats.length === 0 && <tr><td colSpan={5} style={{ textAlign: 'center', color: '#888' }}>No results yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'LIST' && (
        <div style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 2 }}>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {competitions.map((c) => (
                <div key={c.id} className="card" style={{ padding: '1rem', cursor: 'pointer', border: selected?.id === c.id ? '2px solid #3b82f6' : '1px solid #eee' }}
                  onClick={() => loadCompetition(c.id)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <h3 style={{ margin: 0 }}>{c.name}</h3>
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>
                        {new Date(c.date).toLocaleDateString()} {c.location && `| ${c.location}`}
                      </div>
                      <div style={{ fontSize: '0.85rem', color: '#888' }}>{c.entries?.length || c._count?.entries || 0} entries</div>
                    </div>
                    {isStaff && <button className="btn btn-sm btn-outline" style={{ color: '#ef4444' }} onClick={(e) => { e.stopPropagation(); handleDeleteComp(c.id); }}>Delete</button>}
                  </div>
                </div>
              ))}
              {competitions.length === 0 && <p style={{ color: '#888' }}>No competitions</p>}
            </div>
          </div>

          {selected && (
            <div className="card" style={{ padding: '1rem', flex: 1, maxHeight: '80vh', overflowY: 'auto' }}>
              <h2>{selected.name}</h2>
              <div style={{ fontSize: '0.85rem', color: '#888', marginBottom: '0.5rem' }}>
                {new Date(selected.date).toLocaleDateString()} {selected.location && `| ${selected.location}`}
              </div>
              {selected.description && <p>{selected.description}</p>}

              <h4>Entries ({selected.entries?.length || 0})</h4>
              {isStaff && <button className="btn btn-sm btn-primary" style={{ marginBottom: '0.5rem' }} onClick={() => setShowEntryForm(!showEntryForm)}>+ Add Entry</button>}

              {showEntryForm && (
                <form onSubmit={handleAddEntry} style={{ marginBottom: '0.75rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.3rem' }}>
                    <input className="form-input" placeholder="User ID *" required value={entryForm.userId} onChange={(e) => setEntryForm({ ...entryForm, userId: e.target.value })} />
                    <input className="form-input" placeholder="Weight Class" value={entryForm.weightClass} onChange={(e) => setEntryForm({ ...entryForm, weightClass: e.target.value })} />
                    <input className="form-input" placeholder="Division" value={entryForm.division} onChange={(e) => setEntryForm({ ...entryForm, division: e.target.value })} />
                    <select className="form-input" value={entryForm.medalType} onChange={(e) => setEntryForm({ ...entryForm, medalType: e.target.value })}>
                      <option value="NONE">No Medal</option>
                      <option value="GOLD">🥇 Gold</option>
                      <option value="SILVER">🥈 Silver</option>
                      <option value="BRONZE">🥉 Bronze</option>
                    </select>
                    <input className="form-input" type="number" placeholder="Placement #" value={entryForm.placement} onChange={(e) => setEntryForm({ ...entryForm, placement: e.target.value })} />
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.3rem' }}>
                    <button type="submit" className="btn btn-primary btn-sm">Add</button>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowEntryForm(false)}>Cancel</button>
                  </div>
                </form>
              )}

              {selected.entries?.map((e) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                  <div>
                    <strong>{e.user?.firstName} {e.user?.lastName}</strong>
                    <div style={{ fontSize: '0.8rem', color: '#888' }}>
                      {e.weightClass && `${e.weightClass} | `}{e.division}{e.placement && ` | #${e.placement}`}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '1.3rem' }}>{MEDAL_ICONS[e.medalType]}</span>
                    {isStaff && <button className="btn btn-sm btn-outline" style={{ color: '#ef4444', fontSize: '0.75rem' }} onClick={() => handleDeleteEntry(e.id)}>✕</button>}
                  </div>
                </div>
              ))}
              {(!selected.entries || selected.entries.length === 0) && <p style={{ color: '#888', fontSize: '0.85rem' }}>No entries yet</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
