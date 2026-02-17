import { useState, useEffect } from 'react';
import { certificateApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function CertificatesPage() {
  const { user } = useAuth();
  const isStaff = user && !['STUDENT'].includes(user.role);
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [tab, setTab] = useState('CERTS');
  const [templates, setTemplates] = useState([]);
  const [certs, setCerts] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [editTemplate, setEditTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({ name: '', layout: '{}', backgroundUrl: '' });
  const [generateForm, setGenerateForm] = useState({ promotionId: '' });
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [showGenerate, setShowGenerate] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const formatError = (err, context) => {
    const status = err?.status || 'Unknown';
    const endpoint = err?.endpoint || 'N/A';
    let message = err?.message;
    if (typeof message === 'object') message = JSON.stringify(message);
    if (!message) message = typeof err === 'object' ? JSON.stringify(err) : String(err);
    return `[CERT-${context}] HTTP ${status} (${endpoint}): ${message}`;
  };

  useEffect(() => {
    setLoading(true);
    schoolApi.getAll()
      .then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); })
      .catch((err) => setError(formatError(err, 'SCHOOLS')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    setError(null);
    setLoading(true);
    Promise.all([
      certificateApi.getTemplates(schoolId).then(setTemplates).catch((err) => { throw { ...err, context: 'TEMPLATES' }; }),
      certificateApi.getCertificates(schoolId).then(setCerts).catch((err) => { throw { ...err, context: 'CERTS' }; }),
    ])
      .catch((err) => setError(formatError(err, err.context || 'LOAD')))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setError(null);
    const data = { ...templateForm };
    try { data.layout = JSON.parse(data.layout); } catch { data.layout = {}; }
    try {
      if (editTemplate) {
        await certificateApi.updateTemplate(editTemplate.id, data);
      } else {
        await certificateApi.createTemplate(schoolId, data);
      }
      setShowTemplateForm(false);
      setEditTemplate(null);
      setTemplateForm({ name: '', layout: '{}', backgroundUrl: '' });
      certificateApi.getTemplates(schoolId).then(setTemplates).catch((err) => setError(formatError(err, 'REFRESH-TPL')));
    } catch (err) {
      setError(formatError(err, editTemplate ? 'UPDATE-TPL' : 'CREATE-TPL'));
    }
  };

  const handleGenerate = async (e) => {
    e.preventDefault();
    setError(null);
    try {
      await certificateApi.generate({ templateId: selectedTemplateId, promotionId: generateForm.promotionId });
      setShowGenerate(false);
      setGenerateForm({ promotionId: '' });
      certificateApi.getCertificates(schoolId).then(setCerts).catch((err) => setError(formatError(err, 'REFRESH-CERTS')));
    } catch (err) {
      setError(formatError(err, 'GENERATE'));
    }
  };

  const handleDeleteTemplate = async (id) => {
    if (!confirm('Delete template?')) return;
    setError(null);
    try {
      await certificateApi.deleteTemplate(id);
      certificateApi.getTemplates(schoolId).then(setTemplates).catch((err) => setError(formatError(err, 'REFRESH-TPL')));
    } catch (err) {
      setError(formatError(err, 'DELETE-TPL'));
    }
  };

  const previewLayout = (layout) => {
    try {
      const l = typeof layout === 'string' ? JSON.parse(layout) : layout;
      return (
        <div style={{ border: '2px solid #d4af37', borderRadius: '12px', padding: '2rem', textAlign: 'center', background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)', margin: '1rem 0', position: 'relative' }}>
          <div style={{ fontSize: '0.8rem', color: '#92400e', letterSpacing: '3px', textTransform: 'uppercase' }}>{l.header || 'Certificate of Achievement'}</div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.5rem 0', color: '#78350f' }}>{l.title || '[Student Name]'}</div>
          <div style={{ fontSize: '0.9rem', color: '#92400e' }}>{l.subtitle || 'Has been promoted to'}</div>
          <div style={{ fontSize: '1.3rem', fontWeight: 600, color: '#b45309', margin: '0.5rem 0' }}>{l.beltText || '[Belt Name]'}</div>
          <div style={{ fontSize: '0.8rem', color: '#92400e', marginTop: '1rem' }}>{l.footer || 'Date: [Date] | School: [School Name]'}</div>
          <div style={{ position: 'absolute', top: '10px', right: '15px', fontSize: '1.5rem' }}>🥋</div>
        </div>
      );
    } catch {
      return <p style={{ color: '#888' }}>Invalid layout JSON</p>;
    }
  };

  return (
    <div className="page">
      <h1>🏅 Belt Certificates</h1>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#991b1b' }}>
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} style={{ marginLeft: '1rem', background: 'none', border: 'none', color: '#991b1b', cursor: 'pointer', fontWeight: 'bold' }}>✕</button>
        </div>
      )}

      {loading && <div style={{ color: '#666', marginBottom: '1rem' }}>Loading...</div>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <button className={`btn ${tab === 'CERTS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('CERTS')}>Certificates</button>
        {isStaff && <button className={`btn ${tab === 'TEMPLATES' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('TEMPLATES')}>Templates</button>}
        {isStaff && <button className="btn btn-primary" onClick={() => setShowGenerate(true)}>Generate Certificate</button>}
      </div>

      {showGenerate && isStaff && (
        <form onSubmit={handleGenerate} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>Generate Certificate from Promotion</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <select className="form-input" required value={selectedTemplateId} onChange={(e) => setSelectedTemplateId(e.target.value)}>
              <option value="">Select Template *</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <input className="form-input" placeholder="Promotion ID *" required value={generateForm.promotionId} onChange={(e) => setGenerateForm({ ...generateForm, promotionId: e.target.value })} />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button type="submit" className="btn btn-primary">Generate</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowGenerate(false)}>Cancel</button>
          </div>
        </form>
      )}

      {tab === 'CERTS' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1rem' }}>
          {certs.map((c) => (
            <div key={c.id} className="card" style={{ padding: '1rem' }}>
              {previewLayout(c.template?.layout)}
              <div style={{ fontSize: '0.85rem' }}>
                <strong>{c.studentName}</strong> — {c.beltName}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                Program: {c.programName} | School: {c.schoolName}
              </div>
              <div style={{ fontSize: '0.8rem', color: '#888' }}>
                Issued: {new Date(c.issuedDate).toLocaleDateString()} {c.certificateNumber && `| #${c.certificateNumber}`}
              </div>
            </div>
          ))}
          {certs.length === 0 && <p style={{ color: '#888' }}>No certificates generated yet</p>}
        </div>
      )}

      {tab === 'TEMPLATES' && isStaff && (
        <>
          <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => { setShowTemplateForm(true); setEditTemplate(null); setTemplateForm({ name: '', layout: JSON.stringify({ header: 'Certificate of Achievement', title: '[Student Name]', subtitle: 'Has been promoted to', beltText: '[Belt Name]', footer: 'Date: [Date] | School: [School Name]' }, null, 2), backgroundUrl: '' }); }}>+ New Template</button>

          {showTemplateForm && (
            <form onSubmit={handleSaveTemplate} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <h3>{editTemplate ? 'Edit' : 'New'} Template</h3>
              <input className="form-input" placeholder="Template Name *" required value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              <input className="form-input" placeholder="Background Image URL" value={templateForm.backgroundUrl} onChange={(e) => setTemplateForm({ ...templateForm, backgroundUrl: e.target.value })} style={{ marginTop: '0.5rem' }} />
              <label style={{ marginTop: '0.5rem', display: 'block', fontSize: '0.85rem', fontWeight: 600 }}>Layout JSON:</label>
              <textarea className="form-input" rows={8} value={templateForm.layout} onChange={(e) => setTemplateForm({ ...templateForm, layout: e.target.value })} style={{ fontFamily: 'monospace', fontSize: '0.85rem' }} />
              <h4>Preview:</h4>
              {previewLayout(templateForm.layout)}
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowTemplateForm(false)}>Cancel</button>
              </div>
            </form>
          )}

          {templates.map((t) => (
            <div key={t.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>{t.name}</h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button className="btn btn-sm btn-outline" onClick={() => { setEditTemplate(t); setTemplateForm({ name: t.name, layout: JSON.stringify(t.layout, null, 2), backgroundUrl: t.backgroundUrl || '' }); setShowTemplateForm(true); }}>Edit</button>
                  <button className="btn btn-sm btn-outline" style={{ color: '#ef4444' }} onClick={() => handleDeleteTemplate(t.id)}>Delete</button>
                </div>
              </div>
              {previewLayout(t.layout)}
            </div>
          ))}
          {templates.length === 0 && <p style={{ color: '#888' }}>No templates yet</p>}
        </>
      )}
    </div>
  );
}
