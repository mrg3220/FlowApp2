import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { certificationApi } from '../api/client';
import { displayTitle } from '../utils/displayRole';

const TITLES = ['LOHAN_CANDIDATE', 'LOHAN_CERTIFIED', 'SIFU_ASSOCIATE', 'SIFU'];
const TITLE_INFO = {
  LOHAN_CANDIDATE: { label: 'Lohan Candidate', fee: 250, icon: '🥋', description: 'Begin the path of the Lohan. Demonstrates dedication to traditional arts.' },
  LOHAN_CERTIFIED: { label: 'Lohan Certified', fee: 500, icon: '🏅', description: 'Full Lohan certification. Deep knowledge of forms, philosophy, and teaching ability.' },
  SIFU_ASSOCIATE: { label: 'Sifu Associate', fee: 750, icon: '🎓', description: 'Associate instructor rank. Can assist in teaching under a Sifu.' },
  SIFU: { label: 'Sifu', fee: 1000, icon: '👑', description: 'Master instructor. Can lead a school and promote students.' },
};
const STATUS_COLORS = { DRAFT: '#6c757d', SUBMITTED: '#0d6efd', UNDER_REVIEW: '#fd7e14', APPROVED: '#198754', DENIED: '#dc3545', WITHDRAWN: '#6c757d' };

export default function CertificationsPage() {
  const { user, isSuperAdmin, isOwner } = useAuth();
  const [apps, setApps] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ targetTitle: 'LOHAN_CANDIDATE', applicationData: { motivation: '', experience: '', references: '' } });
  const [reviewForm, setReviewForm] = useState({ status: 'APPROVED', reviewNotes: '' });
  const [error, setError] = useState('');
  const canReview = isSuperAdmin || isOwner;

  useEffect(() => { loadApps(); }, []);

  const loadApps = async () => {
    try { setApps(await certificationApi.getAll()); } catch (e) { setError(e.message); }
  };

  const loadDetail = async (id) => {
    try { setSelected(await certificationApi.getById(id)); } catch (e) { setError(e.message); }
  };

  const handleCreate = async () => {
    try {
      setError('');
      await certificationApi.create({ targetTitle: form.targetTitle, applicationData: form.applicationData });
      setShowForm(false); loadApps();
    } catch (e) { setError(e.message); }
  };

  const handleSubmit = async (id) => {
    try { await certificationApi.submit(id); loadApps(); loadDetail(id); } catch (e) { setError(e.message); }
  };

  const handleWithdraw = async (id) => {
    if (!confirm('Withdraw this application?')) return;
    try { await certificationApi.withdraw(id); loadApps(); loadDetail(id); } catch (e) { setError(e.message); }
  };

  const handleReview = async (id) => {
    try {
      await certificationApi.review(id, reviewForm);
      setReviewForm({ status: 'APPROVED', reviewNotes: '' });
      loadApps(); loadDetail(id);
    } catch (e) { setError(e.message); }
  };

  const handleMarkPaid = async (id) => {
    try { await certificationApi.markPaid(id); loadApps(); loadDetail(id); } catch (e) { setError(e.message); }
  };

  // ─── Detail View ────────────────────────────────────────
  if (selected) {
    const info = TITLE_INFO[selected.targetTitle];
    return (
      <div className="page">
        <button className="btn btn-outline" onClick={() => setSelected(null)} style={{ marginBottom: '1rem' }}>← Back</button>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h2>{info?.icon} Application for {info?.label || selected.targetTitle}</h2>
              <p style={{ color: '#666' }}>Applicant: {selected.user?.firstName} {selected.user?.lastName} ({selected.user?.email})</p>
            </div>
            <span className="badge" style={{ backgroundColor: STATUS_COLORS[selected.status], color: '#fff', padding: '0.4rem 0.8rem' }}>{selected.status}</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', margin: '1rem 0' }}>
            <div><strong>Current Title:</strong> {displayTitle(selected.user?.title) || 'None'}</div>
            <div><strong>Belt Rank:</strong> {selected.user?.beltRank || 'N/A'}</div>
            <div><strong>Fee:</strong> ${selected.feeAmount?.toFixed(2) || '0.00'}</div>
            <div><strong>Fee Paid:</strong> {selected.feePaid ? <span style={{ color: '#198754' }}>✓ Yes</span> : <span style={{ color: '#dc3545' }}>✗ No</span>}</div>
            {selected.submittedAt && <div><strong>Submitted:</strong> {new Date(selected.submittedAt).toLocaleDateString()}</div>}
            {selected.reviewedAt && <div><strong>Reviewed:</strong> {new Date(selected.reviewedAt).toLocaleDateString()}</div>}
          </div>

          {/* Application Data */}
          {selected.applicationData && (
            <div style={{ marginTop: '1rem' }}>
              <h3>Application Details</h3>
              {Object.entries(selected.applicationData).map(([key, val]) => (
                <div key={key} style={{ marginBottom: '0.75rem' }}>
                  <strong style={{ textTransform: 'capitalize' }}>{key}:</strong>
                  <p style={{ margin: '0.25rem 0', whiteSpace: 'pre-wrap' }}>{val || 'Not provided'}</p>
                </div>
              ))}
            </div>
          )}

          {/* Applicant actions */}
          {selected.userId === user?.id && (
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              {selected.status === 'DRAFT' && <button className="btn" onClick={() => handleSubmit(selected.id)}>Submit Application</button>}
              {!['APPROVED', 'WITHDRAWN'].includes(selected.status) && <button className="btn btn-outline" onClick={() => handleWithdraw(selected.id)}>Withdraw</button>}
            </div>
          )}

          {/* Review Notes */}
          {selected.reviewNotes && (
            <div className="card" style={{ marginTop: '1rem', backgroundColor: '#f8f9fa' }}>
              <strong>Review Notes:</strong>
              <p>{selected.reviewNotes}</p>
              {selected.reviewedBy && <small>Reviewed by {selected.reviewedBy.firstName} {selected.reviewedBy.lastName}</small>}
            </div>
          )}

          {/* Reviewer actions */}
          {canReview && ['SUBMITTED', 'UNDER_REVIEW'].includes(selected.status) && (
            <div className="card" style={{ marginTop: '1rem', border: '2px solid #0d6efd' }}>
              <h3>Review Application</h3>
              {!selected.feePaid && (
                <div style={{ marginBottom: '1rem' }}>
                  <button className="btn btn-sm" onClick={() => handleMarkPaid(selected.id)}>Mark Fee as Paid</button>
                </div>
              )}
              <div className="form-group">
                <label>Decision</label>
                <select value={reviewForm.status} onChange={(e) => setReviewForm({ ...reviewForm, status: e.target.value })}>
                  <option value="UNDER_REVIEW">Under Review</option>
                  <option value="APPROVED">Approve</option>
                  <option value="DENIED">Deny</option>
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea value={reviewForm.reviewNotes} onChange={(e) => setReviewForm({ ...reviewForm, reviewNotes: e.target.value })} rows={3} placeholder="Review notes..." />
              </div>
              <button className="btn" onClick={() => handleReview(selected.id)}>Submit Review</button>
            </div>
          )}
        </div>
        {error && <div className="error-message">{error}</div>}
      </div>
    );
  }

  // ─── List View ──────────────────────────────────────────
  return (
    <div className="page">
      <div className="page-header">
        <h1>🏅 Certifications & Titles</h1>
        <button className="btn" onClick={() => setShowForm(true)}>+ Apply for Title</button>
      </div>
      {error && <div className="error-message">{error}</div>}

      {/* Current Title */}
      <div className="card" style={{ marginBottom: '1.5rem', background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ fontSize: '2rem' }}>{TITLE_INFO[user?.title]?.icon || '🥋'}</div>
          <div>
            <div style={{ fontSize: '0.85rem', opacity: 0.8 }}>Your Current Title</div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{displayTitle(user?.title) || 'No Title'}</div>
          </div>
        </div>
      </div>

      {/* Title Application Form */}
      {showForm && (
        <div className="card" style={{ marginBottom: '1.5rem', border: '2px solid var(--primary)' }}>
          <h3>Apply for a Title</h3>
          <div className="form-group">
            <label>Target Title</label>
            <select value={form.targetTitle} onChange={(e) => setForm({ ...form, targetTitle: e.target.value })}>
              {TITLES.map((t) => <option key={t} value={t}>{TITLE_INFO[t].label} (${TITLE_INFO[t].fee})</option>)}
            </select>
          </div>
          {TITLE_INFO[form.targetTitle] && (
            <p style={{ color: '#666', marginBottom: '1rem' }}>{TITLE_INFO[form.targetTitle].description}</p>
          )}
          <div className="form-group">
            <label>Motivation / Why are you applying?</label>
            <textarea value={form.applicationData.motivation} onChange={(e) => setForm({ ...form, applicationData: { ...form.applicationData, motivation: e.target.value } })} rows={3} />
          </div>
          <div className="form-group">
            <label>Relevant Experience</label>
            <textarea value={form.applicationData.experience} onChange={(e) => setForm({ ...form, applicationData: { ...form.applicationData, experience: e.target.value } })} rows={3} />
          </div>
          <div className="form-group">
            <label>References</label>
            <textarea value={form.applicationData.references} onChange={(e) => setForm({ ...form, applicationData: { ...form.applicationData, references: e.target.value } })} rows={2} placeholder="Names and contact info of references" />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="btn" onClick={handleCreate}>Create Draft</button>
            <button className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {/* Title Progression Path */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <h3>Title Progression Path</h3>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', justifyContent: 'center', padding: '1rem 0' }}>
          {TITLES.map((t, i) => (
            <div key={t} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <div style={{ textAlign: 'center', padding: '1rem', borderRadius: '12px', backgroundColor: user?.title === t ? '#e8f5e9' : '#f5f5f5', border: user?.title === t ? '2px solid #198754' : '1px solid #ddd', minWidth: '120px' }}>
                <div style={{ fontSize: '1.5rem' }}>{TITLE_INFO[t].icon}</div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{TITLE_INFO[t].label}</div>
                <div style={{ fontSize: '0.75rem', color: '#666' }}>${TITLE_INFO[t].fee}</div>
              </div>
              {i < TITLES.length - 1 && <span style={{ fontSize: '1.5rem', color: '#ccc' }}>→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Applications List */}
      <div className="card">
        <h3>{canReview ? 'All Applications' : 'My Applications'}</h3>
        {apps.length > 0 ? (
          <table className="data-table">
            <thead><tr>{canReview && <th>Applicant</th>}<th>Title</th><th>Status</th><th>Fee</th><th>Paid</th><th>Submitted</th><th>Actions</th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  {canReview && <td>{a.user?.firstName} {a.user?.lastName}</td>}
                  <td>{TITLE_INFO[a.targetTitle]?.icon} {TITLE_INFO[a.targetTitle]?.label}</td>
                  <td><span className="badge" style={{ backgroundColor: STATUS_COLORS[a.status], color: '#fff' }}>{a.status}</span></td>
                  <td>${a.feeAmount?.toFixed(2) || '0'}</td>
                  <td>{a.feePaid ? '✓' : '✗'}</td>
                  <td>{a.submittedAt ? new Date(a.submittedAt).toLocaleDateString() : '-'}</td>
                  <td><button className="btn btn-sm btn-outline" onClick={() => loadDetail(a.id)}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="empty-state">No applications yet</p>}
      </div>
    </div>
  );
}
