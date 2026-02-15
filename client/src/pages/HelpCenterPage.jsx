import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { helpApi } from '../api/client';

export default function HelpCenterPage() {
  const { user, isSuperAdmin, isMarketing } = useAuth();
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: '', content: '', category: '', roles: [], tags: [], sortOrder: 0, isPublished: true });
  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState('');
  const canManage = isSuperAdmin || isMarketing;

  useEffect(() => { loadArticles(); loadCategories(); }, []);

  const loadArticles = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category = selectedCategory;
      if (search) params.search = search;
      setArticles(await helpApi.getArticles(params));
    } catch (e) { setError(e.message); }
  };

  const loadCategories = async () => {
    try { setCategories(await helpApi.getCategories()); } catch {}
  };

  useEffect(() => { loadArticles(); }, [selectedCategory]);

  const handleSearch = (e) => {
    e.preventDefault();
    loadArticles();
  };

  const handleSave = async () => {
    try {
      setError('');
      if (selected) {
        await helpApi.updateArticle(selected.id, form);
      } else {
        await helpApi.createArticle(form);
      }
      setShowForm(false); setSelected(null); loadArticles(); loadCategories();
    } catch (e) { setError(e.message); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this article?')) return;
    try { await helpApi.deleteArticle(id); loadArticles(); loadCategories(); } catch (e) { setError(e.message); }
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim().toLowerCase())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim().toLowerCase()] });
      setTagInput('');
    }
  };

  const editArticle = (a) => {
    setForm({ title: a.title, content: a.content, category: a.category, roles: a.roles || [], tags: a.tags || [], sortOrder: a.sortOrder || 0, isPublished: a.isPublished });
    setSelected(a);
    setShowForm(true);
  };

  const ALL_ROLES = ['SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'STUDENT', 'EVENT_COORDINATOR', 'MARKETING', 'SCHOOL_STAFF'];
  const CATEGORY_ICONS = { 'Getting Started': '🚀', 'Classes': '🥋', 'Events': '🎪', 'Billing': '💰', 'Promotions': '📈', 'Students': '🎓', 'Administration': '⚙️' };

  // ─── Article Detail View ────────────────────────────────
  if (selected && !showForm) {
    return (
      <div className="page">
        <button className="btn btn-outline" onClick={() => setSelected(null)} style={{ marginBottom: '1rem' }}>← Back to Help Center</button>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span className="badge" style={{ marginBottom: '0.5rem' }}>{selected.category}</span>
              <h2>{selected.title}</h2>
            </div>
            {canManage && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button className="btn btn-sm" onClick={() => editArticle(selected)}>Edit</button>
                <button className="btn btn-sm btn-outline" style={{ color: '#e74c3c' }} onClick={() => handleDelete(selected.id)}>Delete</button>
              </div>
            )}
          </div>
          <div style={{ marginTop: '1rem', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{selected.content}</div>
          {selected.tags?.length > 0 && (
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {selected.tags.map((t) => <span key={t} className="badge" style={{ backgroundColor: '#e9ecef', color: '#495057' }}>#{t}</span>)}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Help Center Main View ──────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <h1>❓ Help Center</h1>
        {canManage && <button className="btn" onClick={() => { setForm({ title: '', content: '', category: categories[0] || 'Getting Started', roles: [], tags: [], sortOrder: 0, isPublished: true }); setSelected(null); setShowForm(true); }}>+ New Article</button>}
      </div>
      {error && <div className="error-message">{error}</div>}

      {/* Search */}
      <form onSubmit={handleSearch} style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search help articles..." style={{ flex: 1 }} />
          <button type="submit" className="btn">Search</button>
        </div>
      </form>

      {/* Article Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--primary)' }}>
          <h3>{selected ? 'Edit Article' : 'New Article'}</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem' }}>
            <div className="form-group"><label>Title *</label><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></div>
            <div className="form-group"><label>Category *</label><input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} list="categories" /><datalist id="categories">{categories.map((c) => <option key={c} value={c} />)}</datalist></div>
            <div className="form-group"><label>Sort Order</label><input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} /></div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingTop: '1.5rem' }}>
              <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} id="published" />
              <label htmlFor="published" style={{ margin: 0 }}>Published</label>
            </div>
          </div>
          <div className="form-group"><label>Content *</label><textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} rows={8} /></div>
          <div className="form-group">
            <label>Visible to Roles (empty = all)</label>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {ALL_ROLES.map((r) => (
                <label key={r} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}>
                  <input type="checkbox" checked={form.roles.includes(r)} onChange={(e) => {
                    if (e.target.checked) setForm({ ...form, roles: [...form.roles, r] });
                    else setForm({ ...form, roles: form.roles.filter((x) => x !== r) });
                  }} />{r}
                </label>
              ))}
            </div>
          </div>
          <div className="form-group">
            <label>Tags</label>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())} placeholder="Add tag" />
              <button type="button" className="btn btn-sm" onClick={addTag}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
              {form.tags.map((t) => <span key={t} className="badge" style={{ cursor: 'pointer' }} onClick={() => setForm({ ...form, tags: form.tags.filter((x) => x !== t) })}>#{t} ✕</span>)}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={handleSave}>{selected ? 'Update' : 'Create'}</button>
            <button className="btn btn-outline" onClick={() => { setShowForm(false); setSelected(null); }}>Cancel</button>
          </div>
        </div>
      )}

      {/* Categories + Articles */}
      <div style={{ display: 'flex', gap: '1.5rem', flexDirection: window.innerWidth < 768 ? 'column' : 'row' }}>
        {/* Category List */}
        <div style={{ minWidth: '200px' }}>
          <div className="card">
            <h3>Categories</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
              <button className={`btn btn-sm ${!selectedCategory ? '' : 'btn-outline'}`} onClick={() => setSelectedCategory('')} style={{ textAlign: 'left' }}>All Articles</button>
              {categories.map((c) => (
                <button key={c} className={`btn btn-sm ${selectedCategory === c ? '' : 'btn-outline'}`} onClick={() => setSelectedCategory(c)} style={{ textAlign: 'left' }}>
                  {CATEGORY_ICONS[c] || '📄'} {c}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Articles Grid */}
        <div style={{ flex: 1 }}>
          {articles.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
              {articles.map((a) => (
                <div key={a.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setSelected(a)}>
                  <span className="badge" style={{ marginBottom: '0.5rem' }}>{CATEGORY_ICONS[a.category] || '📄'} {a.category}</span>
                  <h3 style={{ margin: '0.25rem 0' }}>{a.title}</h3>
                  <p style={{ color: '#666', fontSize: '0.9rem', margin: '0.5rem 0' }}>{a.content.substring(0, 120)}...</p>
                  {a.tags?.length > 0 && (
                    <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                      {a.tags.slice(0, 3).map((t) => <span key={t} style={{ fontSize: '0.75rem', color: '#888' }}>#{t}</span>)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : <p className="empty-state" style={{ textAlign: 'center' }}>No articles found</p>}
        </div>
      </div>
    </div>
  );
}
