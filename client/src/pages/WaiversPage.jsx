import { useState, useEffect } from 'react';
import { waiverApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function WaiversPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [tab, setTab] = useState(isStudent ? 'MY' : 'TEMPLATES');
  const [templates, setTemplates] = useState([]);
  const [waivers, setWaivers] = useState([]);
  const [myWaivers, setMyWaivers] = useState([]);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [templateForm, setTemplateForm] = useState({ name: '', content: '', requiresSignature: true, expiresInDays: '' });
  const [editTemplateId, setEditTemplateId] = useState(null);
  const [sendForm, setSendForm] = useState({ templateId: '', userId: '' });
  const [showSendForm, setShowSendForm] = useState(false);
  const [signWaiver, setSignWaiver] = useState(null);
  const [signatureInput, setSignatureInput] = useState('');

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    if (!isStudent) {
      waiverApi.getTemplates(schoolId).then(setTemplates);
      waiverApi.getWaivers(schoolId).then(setWaivers);
    }
    waiverApi.getMyWaivers().then(setMyWaivers);
  }, [schoolId]);

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    const data = { ...templateForm, expiresInDays: templateForm.expiresInDays ? Number(templateForm.expiresInDays) : null };
    if (editTemplateId) {
      await waiverApi.updateTemplate(editTemplateId, data);
    } else {
      await waiverApi.createTemplate(schoolId, data);
    }
    setShowTemplateForm(false);
    setEditTemplateId(null);
    setTemplateForm({ name: '', content: '', requiresSignature: true, expiresInDays: '' });
    waiverApi.getTemplates(schoolId).then(setTemplates);
  };

  const handleSend = async (e) => {
    e.preventDefault();
    await waiverApi.sendWaiver(schoolId, sendForm);
    setShowSendForm(false);
    setSendForm({ templateId: '', userId: '' });
    waiverApi.getWaivers(schoolId).then(setWaivers);
  };

  const handleSign = async () => {
    await waiverApi.signWaiver(signWaiver.id, { signatureData: signatureInput });
    setSignWaiver(null);
    setSignatureInput('');
    waiverApi.getMyWaivers().then(setMyWaivers);
    if (!isStudent) waiverApi.getWaivers(schoolId).then(setWaivers);
  };

  const statusBadge = (s) => {
    const c = { PENDING: '#f59e0b', SIGNED: '#22c55e', EXPIRED: '#888', REVOKED: '#ef4444' };
    return <span style={{ padding: '0.15rem 0.5rem', borderRadius: '10px', fontSize: '0.8rem', background: (c[s] || '#888') + '20', color: c[s] || '#888' }}>{s}</span>;
  };

  return (
    <div className="page">
      <h1>📝 Digital Waivers & Contracts</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {!isStudent && (
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {!isStudent && <button className={`btn ${tab === 'TEMPLATES' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('TEMPLATES')}>Templates</button>}
        {!isStudent && <button className={`btn ${tab === 'ALL' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('ALL')}>All Waivers</button>}
        <button className={`btn ${tab === 'MY' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('MY')}>My Waivers</button>
      </div>

      {tab === 'TEMPLATES' && !isStudent && (
        <>
          <button className="btn btn-primary" style={{ marginBottom: '1rem' }} onClick={() => { setShowTemplateForm(!showTemplateForm); setEditTemplateId(null); setTemplateForm({ name: '', content: '', requiresSignature: true, expiresInDays: '' }); }}>+ New Template</button>
          {showTemplateForm && (
            <form onSubmit={handleSaveTemplate} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
              <h3>{editTemplateId ? 'Edit' : 'New'} Template</h3>
              <input className="form-input" placeholder="Template Name *" required value={templateForm.name} onChange={(e) => setTemplateForm({ ...templateForm, name: e.target.value })} />
              <textarea className="form-input" placeholder="Waiver Content (full legal text)" rows={8} required value={templateForm.content} onChange={(e) => setTemplateForm({ ...templateForm, content: e.target.value })} style={{ marginTop: '0.5rem' }} />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.5rem', alignItems: 'center' }}>
                <label><input type="checkbox" checked={templateForm.requiresSignature} onChange={(e) => setTemplateForm({ ...templateForm, requiresSignature: e.target.checked })} /> Requires Signature</label>
                <input className="form-input" type="number" placeholder="Expires in days (optional)" value={templateForm.expiresInDays} onChange={(e) => setTemplateForm({ ...templateForm, expiresInDays: e.target.value })} style={{ width: '200px' }} />
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Save</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowTemplateForm(false)}>Cancel</button>
              </div>
            </form>
          )}
          <table className="data-table">
            <thead><tr><th>Name</th><th>Signature</th><th>Expires</th><th>Actions</th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td>{t.requiresSignature ? '✅ Yes' : '—'}</td>
                  <td>{t.expiresInDays ? `${t.expiresInDays} days` : 'Never'}</td>
                  <td>
                    <button className="btn btn-sm btn-outline" onClick={() => { setEditTemplateId(t.id); setTemplateForm({ name: t.name, content: t.content, requiresSignature: t.requiresSignature, expiresInDays: t.expiresInDays || '' }); setShowTemplateForm(true); }}>Edit</button>
                    <button className="btn btn-sm btn-primary" style={{ marginLeft: '0.25rem' }} onClick={() => { setSendForm({ ...sendForm, templateId: t.id }); setShowSendForm(true); }}>Send</button>
                  </td>
                </tr>
              ))}
              {templates.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>No templates</td></tr>}
            </tbody>
          </table>
          {showSendForm && (
            <form onSubmit={handleSend} className="card" style={{ padding: '1rem', marginTop: '1rem' }}>
              <h3>Send Waiver</h3>
              <input className="form-input" placeholder="User ID *" required value={sendForm.userId} onChange={(e) => setSendForm({ ...sendForm, userId: e.target.value })} />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="btn btn-primary">Send</button>
                <button type="button" className="btn btn-outline" onClick={() => setShowSendForm(false)}>Cancel</button>
              </div>
            </form>
          )}
        </>
      )}

      {tab === 'ALL' && !isStudent && (
        <table className="data-table">
          <thead><tr><th>Student</th><th>Template</th><th>Status</th><th>Signed At</th></tr></thead>
          <tbody>
            {waivers.map((w) => (
              <tr key={w.id}>
                <td>{w.user?.firstName} {w.user?.lastName}</td>
                <td>{w.template?.name}</td>
                <td>{statusBadge(w.status)}</td>
                <td>{w.signedAt ? new Date(w.signedAt).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
            {waivers.length === 0 && <tr><td colSpan={4} style={{ textAlign: 'center', color: '#888' }}>No waivers</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'MY' && (
        <>
          {myWaivers.map((w) => (
            <div key={w.id} className="card" style={{ padding: '1rem', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{w.template?.name}</h3>
                  <div style={{ marginTop: '0.25rem' }}>{statusBadge(w.status)}</div>
                </div>
                {w.status === 'PENDING' && (
                  <button className="btn btn-primary" onClick={() => setSignWaiver(w)}>Review & Sign</button>
                )}
              </div>
              {w.signedAt && <p style={{ fontSize: '0.85rem', color: '#888', margin: '0.5rem 0 0' }}>Signed: {new Date(w.signedAt).toLocaleString()}</p>}
            </div>
          ))}
          {myWaivers.length === 0 && <p style={{ color: '#888' }}>No waivers assigned to you</p>}
        </>
      )}

      {signWaiver && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card" style={{ padding: '2rem', maxWidth: '600px', width: '90%', maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>Review & Sign: {signWaiver.template?.name}</h2>
            <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', fontSize: '0.9rem' }}>
              {signWaiver.template?.content}
            </div>
            <label><strong>Type your full name to sign:</strong></label>
            <input className="form-input" placeholder="Full Name" value={signatureInput} onChange={(e) => setSignatureInput(e.target.value)} style={{ marginTop: '0.5rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" disabled={!signatureInput.trim()} onClick={handleSign}>Sign Waiver</button>
              <button className="btn btn-outline" onClick={() => { setSignWaiver(null); setSignatureInput(''); }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
