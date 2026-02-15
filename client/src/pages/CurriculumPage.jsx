import { useState, useEffect } from 'react';
import { curriculumApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function CurriculumPage() {
  const { user } = useAuth();
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBelt, setFilterBelt] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', category: '', videoUrl: '', imageUrl: '', instructions: '', isPublic: true });

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    loadItems();
    curriculumApi.getCategories(schoolId).then(setCategories).catch(() => setCategories([]));
  }, [schoolId, filterCategory, filterBelt]);

  const loadItems = () => {
    const p = {};
    if (filterCategory) p.category = filterCategory;
    if (filterBelt) p.beltId = filterBelt;
    curriculumApi.getBySchool(schoolId, p).then(setItems);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (selected?.id && showForm) {
      await curriculumApi.update(selected.id, form);
    } else {
      await curriculumApi.create(schoolId, form);
    }
    setShowForm(false);
    setForm({ title: '', description: '', category: '', videoUrl: '', imageUrl: '', instructions: '', isPublic: true });
    loadItems();
  };

  const handleEdit = (item) => {
    setForm({ title: item.title, description: item.description || '', category: item.category || '', videoUrl: item.videoUrl || '', imageUrl: item.imageUrl || '', instructions: item.instructions || '', isPublic: item.isPublic });
    setSelected(item);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this curriculum item?')) return;
    await curriculumApi.delete(id);
    if (selected?.id === id) setSelected(null);
    loadItems();
  };

  const isStaff = user && !['STUDENT'].includes(user.role);

  return (
    <div className="page">
      <h1>📚 Curriculum & Technique Library</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {isStaff && <button className="btn btn-primary" onClick={() => { setSelected(null); setForm({ title: '', description: '', category: '', videoUrl: '', imageUrl: '', instructions: '', isPublic: true }); setShowForm(!showForm); }}>+ Add Technique</button>}
      </div>

      {showForm && isStaff && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>{selected?.id ? 'Edit' : 'New'} Technique</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Title *" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="form-input" placeholder="Category (e.g. Kicks, Blocks)" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
            <input className="form-input" placeholder="Video URL" value={form.videoUrl} onChange={(e) => setForm({ ...form, videoUrl: e.target.value })} />
            <input className="form-input" placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </div>
          <textarea className="form-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: '0.5rem' }} />
          <textarea className="form-input" placeholder="Step-by-step instructions" value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} rows={4} style={{ marginTop: '0.5rem' }} />
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input type="checkbox" checked={form.isPublic} onChange={(e) => setForm({ ...form, isPublic: e.target.checked })} /> Visible to Students
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Save</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 2 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
            {items.map((item) => (
              <div key={item.id} className="card" style={{ padding: '1rem', cursor: 'pointer', border: selected?.id === item.id ? '2px solid #3b82f6' : '1px solid #eee' }}
                onClick={() => curriculumApi.getById(item.id).then(setSelected)}>
                {item.imageUrl && <img src={item.imageUrl} alt={item.title} style={{ width: '100%', height: '140px', objectFit: 'cover', borderRadius: '6px', marginBottom: '0.5rem' }} />}
                <h3 style={{ margin: 0 }}>{item.title}</h3>
                {item.category && <span style={{ fontSize: '0.8rem', background: '#e0e7ff', padding: '0.15rem 0.5rem', borderRadius: '10px', color: '#3730a3' }}>{item.category}</span>}
                {item.belt && <span style={{ fontSize: '0.8rem', marginLeft: '0.5rem', color: '#888' }}>{item.belt.name}</span>}
                <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0 0' }}>{item.description?.slice(0, 100)}</p>
              </div>
            ))}
            {items.length === 0 && <p style={{ color: '#888' }}>No techniques found</p>}
          </div>
        </div>

        {selected && !showForm && (
          <div className="card" style={{ padding: '1rem', flex: 1, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>{selected.title}</h2>
            {selected.category && <span style={{ fontSize: '0.85rem', background: '#e0e7ff', padding: '0.2rem 0.6rem', borderRadius: '10px', color: '#3730a3' }}>{selected.category}</span>}
            {selected.belt && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#888' }}>Belt: {selected.belt.name}</span>}
            {selected.program && <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#888' }}>Program: {selected.program.name}</span>}
            {selected.videoUrl && (
              <div style={{ marginTop: '1rem' }}>
                {selected.videoUrl.includes('youtube') || selected.videoUrl.includes('youtu.be') ? (
                  <iframe src={selected.videoUrl.replace('watch?v=', 'embed/')} width="100%" height="200" frameBorder="0" allowFullScreen style={{ borderRadius: '6px' }} />
                ) : (
                  <video src={selected.videoUrl} controls width="100%" style={{ borderRadius: '6px' }} />
                )}
              </div>
            )}
            {selected.description && <p>{selected.description}</p>}
            {selected.instructions && (
              <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem' }}>
                <h4>Instructions</h4>
                <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '0.9rem' }}>{selected.instructions}</pre>
              </div>
            )}
            {isStaff && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button className="btn btn-outline" onClick={() => handleEdit(selected)}>Edit</button>
                <button className="btn btn-outline" style={{ color: '#ef4444' }} onClick={() => handleDelete(selected.id)}>Delete</button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
