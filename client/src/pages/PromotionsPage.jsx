import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { promotionApi, schoolApi, enrollmentApi } from '../api/client';
import { displayRole } from '../utils/displayRole';

const STAFF_TABS = ['Programs', 'Belts & Requirements', 'Enrollments', 'Student Progress', 'Tests', 'Essays'];
const STUDENT_TABS = ['My Progress', 'My Essays'];

export default function PromotionsPage() {
  const { user, isSuperAdmin, isOwner, isInstructor, isStudent } = useAuth();
  const [activeTab, setActiveTab] = useState(isStudent ? 'My Progress' : 'Programs');
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (isSuperAdmin) {
          const data = await schoolApi.getAll();
          setSchools(data);
          if (data.length) setSelectedSchoolId(data[0].id);
        } else if (user?.schoolId) {
          setSelectedSchoolId(user.schoolId);
        }
      } catch { /* ignore */ }
      setLoading(false);
    };
    load();
  }, [isSuperAdmin, user]);

  if (loading) return <div className="loading">Loading...</div>;
  if (!selectedSchoolId && !isSuperAdmin) {
    return <div className="alert alert-error">No school found. Please contact an admin.</div>;
  }

  const tabs = isStudent ? STUDENT_TABS : STAFF_TABS;

  return (
    <div>
      <div className="page-header">
        <h1>🥋 Belt Promotions</h1>
        {isSuperAdmin && schools.length > 1 && (
          <select
            className="form-control"
            style={{ width: 'auto', minWidth: '200px' }}
            value={selectedSchoolId}
            onChange={(e) => setSelectedSchoolId(e.target.value)}
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="billing-tabs">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={`billing-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="billing-content">
        {activeTab === 'Programs' && <ProgramsTab schoolId={selectedSchoolId} />}
        {activeTab === 'Belts & Requirements' && <BeltsTab schoolId={selectedSchoolId} />}
        {activeTab === 'Enrollments' && <EnrollmentsTab schoolId={selectedSchoolId} />}
        {activeTab === 'Student Progress' && <ProgressTab schoolId={selectedSchoolId} />}
        {activeTab === 'Tests' && <TestsTab schoolId={selectedSchoolId} />}
        {activeTab === 'Essays' && <EssaysTab schoolId={selectedSchoolId} />}
        {activeTab === 'My Progress' && <StudentMyProgress />}
        {activeTab === 'My Essays' && <StudentMyEssays />}
      </div>
    </div>
  );
}

// ─── Programs Tab ─────────────────────────────────────────

function ProgramsTab({ schoolId }) {
  const { isSuperAdmin, isOwner } = useAuth();
  const canEdit = isSuperAdmin || isOwner;
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editProg, setEditProg] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', isGlobal: false, hasRankStructure: true });

  const fetch = useCallback(() => {
    setLoading(true);
    promotionApi.getPrograms({ schoolId })
      .then(setPrograms)
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { fetch(); }, [fetch]);

  const resetForm = () => {
    setForm({ name: '', description: '', isGlobal: false, hasRankStructure: true });
    setEditProg(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };
  const openEdit = (p) => {
    setForm({ name: p.name, description: p.description || '', isGlobal: p.isGlobal, hasRankStructure: p.hasRankStructure });
    setEditProg(p);
    setShowModal(true);
  };

  const handleSave = async () => {
    try {
      if (editProg) {
        await promotionApi.updateProgram(editProg.id, form);
      } else {
        await promotionApi.createProgram({ ...form, schoolId: form.isGlobal ? undefined : schoolId });
      }
      setShowModal(false);
      resetForm();
      fetch();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading programs...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      {canEdit && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={openCreate}>+ New Program</button>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Programs</h2></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Type</th>
                <th>Rank Structure</th>
                <th>Belts</th>
                <th>Students</th>
                <th>Status</th>
                {canEdit && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {programs.length === 0 ? (
                <tr><td colSpan={canEdit ? 7 : 6} style={{ textAlign: 'center' }}>No programs yet</td></tr>
              ) : programs.map(p => (
                <tr key={p.id}>
                  <td><strong>{p.name}</strong>{p.description && <div style={{ fontSize: '0.85em', color: '#888' }}>{p.description}</div>}</td>
                  <td><span className={`badge ${p.isGlobal ? 'badge-info' : ''}`}>{p.isGlobal ? '🌐 Global' : '🏫 School'}</span></td>
                  <td>{p.hasRankStructure ? '✅ Yes' : '❌ No'}</td>
                  <td>{p.belts?.length || 0}</td>
                  <td>{p._count?.enrollments || 0}</td>
                  <td><span className={`badge ${p.isActive ? 'badge-success' : 'badge-danger'}`}>{p.isActive ? 'Active' : 'Inactive'}</span></td>
                  {canEdit && (
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={() => openEdit(p)}>Edit</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editProg ? 'Edit' : 'New'} Program</h3>
            <div className="form-group">
              <label>Name *</label>
              <input className="form-control" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Shaolin Wing Chun" />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            {isSuperAdmin && !editProg && (
              <div className="form-group">
                <label>
                  <input type="checkbox" checked={form.isGlobal} onChange={e => setForm({ ...form, isGlobal: e.target.checked })} />
                  {' '}Global program (available to all schools)
                </label>
              </div>
            )}
            <div className="form-group">
              <label>
                <input type="checkbox" checked={form.hasRankStructure} onChange={e => setForm({ ...form, hasRankStructure: e.target.checked })} />
                {' '}Has belt/rank structure
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSave}>{editProg ? 'Update' : 'Create'}</button>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Belts & Requirements Tab ─────────────────────────────

function BeltsTab({ schoolId }) {
  const { isSuperAdmin, isOwner } = useAuth();
  const canEdit = isSuperAdmin || isOwner;
  const [programs, setPrograms] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showBeltModal, setShowBeltModal] = useState(false);
  const [showReqModal, setShowReqModal] = useState(false);
  const [editBelt, setEditBelt] = useState(null);
  const [selectedBeltForReq, setSelectedBeltForReq] = useState(null);
  const [beltForm, setBeltForm] = useState({ name: '', displayOrder: '', color: '#ffffff', description: '' });
  const [reqForm, setReqForm] = useState({ type: 'MIN_ATTENDANCE', description: '', value: '', isRequired: true });

  const fetchPrograms = useCallback(() => {
    setLoading(true);
    promotionApi.getPrograms({ schoolId })
      .then(data => {
        const ranked = data.filter(p => p.hasRankStructure);
        setPrograms(ranked);
        if (ranked.length && !selectedProgram) setSelectedProgram(ranked[0]);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  const fetchProgramDetail = useCallback(() => {
    if (!selectedProgram) return;
    promotionApi.getProgram(selectedProgram.id)
      .then(setSelectedProgram)
      .catch(err => setError(err.message));
  }, [selectedProgram?.id]);

  useEffect(() => { fetchPrograms(); }, [fetchPrograms]);

  const handleSaveBelt = async () => {
    try {
      if (editBelt) {
        await promotionApi.updateBelt(editBelt.id, { ...beltForm, displayOrder: parseInt(beltForm.displayOrder) });
      } else {
        await promotionApi.createBelt(selectedProgram.id, { ...beltForm, displayOrder: parseInt(beltForm.displayOrder) });
      }
      setShowBeltModal(false);
      fetchProgramDetail();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteBelt = async (beltId) => {
    if (!window.confirm('Delete this belt? All requirements will also be deleted.')) return;
    try {
      await promotionApi.deleteBelt(beltId);
      fetchProgramDetail();
    } catch (err) { setError(err.message); }
  };

  const handleSaveReq = async () => {
    try {
      await promotionApi.createRequirement(selectedBeltForReq.id, reqForm);
      setShowReqModal(false);
      fetchProgramDetail();
    } catch (err) { setError(err.message); }
  };

  const handleDeleteReq = async (reqId) => {
    try {
      await promotionApi.deleteRequirement(reqId);
      fetchProgramDetail();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      {/* Program selector */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label><strong>Program:</strong></label>
        <select className="form-control" style={{ width: 'auto', minWidth: '200px' }} value={selectedProgram?.id || ''} onChange={e => {
          const p = programs.find(x => x.id === e.target.value);
          setSelectedProgram(p);
        }}>
          {programs.map(p => <option key={p.id} value={p.id}>{p.name}{p.isGlobal ? ' 🌐' : ''}</option>)}
        </select>
        {canEdit && selectedProgram && (
          <button className="btn btn-primary btn-sm" onClick={() => {
            setBeltForm({ name: '', displayOrder: String((selectedProgram.belts?.length || 0) + 1), color: '#ffffff', description: '' });
            setEditBelt(null);
            setShowBeltModal(true);
          }}>+ Add Belt</button>
        )}
      </div>

      {/* Belt hierarchy */}
      {selectedProgram?.belts?.length > 0 ? (
        <div className="belt-hierarchy">
          {selectedProgram.belts.map(belt => (
            <div key={belt.id} className="card" style={{ marginBottom: '1rem', borderLeft: `4px solid ${belt.color || '#ccc'}` }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>
                  <span style={{ display: 'inline-block', width: 20, height: 20, backgroundColor: belt.color || '#ccc', borderRadius: 4, marginRight: 8, verticalAlign: 'middle', border: '1px solid #555' }} />
                  {belt.name}
                  <span style={{ fontSize: '0.8em', color: '#888', marginLeft: 8 }}>#{belt.displayOrder}</span>
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  {canEdit && (
                    <>
                      <button className="btn btn-sm btn-outline" onClick={() => {
                        setSelectedBeltForReq(belt);
                        setReqForm({ type: 'MIN_ATTENDANCE', description: '', value: '', isRequired: true });
                        setShowReqModal(true);
                      }}>+ Requirement</button>
                      <button className="btn btn-sm btn-outline" onClick={() => {
                        setBeltForm({ name: belt.name, displayOrder: String(belt.displayOrder), color: belt.color || '#ffffff', description: belt.description || '' });
                        setEditBelt(belt);
                        setShowBeltModal(true);
                      }}>Edit</button>
                      <button className="btn btn-sm btn-outline" style={{ color: '#e74c3c' }} onClick={() => handleDeleteBelt(belt.id)}>Delete</button>
                    </>
                  )}
                </div>
              </div>
              {belt.requirements?.length > 0 && (
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Type</th><th>Description</th><th>Value</th><th>Required</th>{canEdit && <th></th>}</tr>
                    </thead>
                    <tbody>
                      {belt.requirements.map(r => (
                        <tr key={r.id}>
                          <td><span className="badge">{r.type.replace(/_/g, ' ')}</span></td>
                          <td>{r.description}</td>
                          <td>{r.value ?? '—'}</td>
                          <td>{r.isRequired ? '✅' : '➖'}</td>
                          {canEdit && <td><button className="btn btn-sm btn-outline" style={{ color: '#e74c3c' }} onClick={() => handleDeleteReq(r.id)}>✕</button></td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {(!belt.requirements || belt.requirements.length === 0) && (
                <div style={{ padding: '0.75rem 1rem', color: '#888', fontStyle: 'italic' }}>No requirements defined yet</div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="alert" style={{ textAlign: 'center' }}>No belts defined for this program yet. {canEdit && 'Click "+ Add Belt" to start building the rank hierarchy.'}</div>
      )}

      {/* Belt modal */}
      {showBeltModal && (
        <div className="modal-backdrop" onClick={() => setShowBeltModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>{editBelt ? 'Edit' : 'New'} Belt</h3>
            <div className="form-group">
              <label>Name *</label>
              <input className="form-control" value={beltForm.name} onChange={e => setBeltForm({ ...beltForm, name: e.target.value })} placeholder="e.g. White Belt" />
            </div>
            <div className="form-group">
              <label>Order (1 = lowest rank) *</label>
              <input className="form-control" type="number" min="1" value={beltForm.displayOrder} onChange={e => setBeltForm({ ...beltForm, displayOrder: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Color</label>
              <input type="color" value={beltForm.color} onChange={e => setBeltForm({ ...beltForm, color: e.target.value })} style={{ width: 50, height: 36, cursor: 'pointer' }} />
            </div>
            <div className="form-group">
              <label>Description</label>
              <textarea className="form-control" value={beltForm.description} onChange={e => setBeltForm({ ...beltForm, description: e.target.value })} rows={2} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSaveBelt}>{editBelt ? 'Update' : 'Create'}</button>
              <button className="btn btn-outline" onClick={() => setShowBeltModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* Requirement modal */}
      {showReqModal && (
        <div className="modal-backdrop" onClick={() => setShowReqModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Add Requirement for {selectedBeltForReq?.name}</h3>
            <div className="form-group">
              <label>Type *</label>
              <select className="form-control" value={reqForm.type} onChange={e => setReqForm({ ...reqForm, type: e.target.value })}>
                <option value="MIN_ATTENDANCE">Min Attendance (class count)</option>
                <option value="TECHNIQUE">Technique</option>
                <option value="TIME_IN_RANK">Time in Rank (months)</option>
                <option value="MIN_AGE">Minimum Age</option>
                <option value="ESSAY">Essay</option>
                <option value="CUSTOM">Custom</option>
              </select>
            </div>
            <div className="form-group">
              <label>Description *</label>
              <input className="form-control" value={reqForm.description} onChange={e => setReqForm({ ...reqForm, description: e.target.value })} placeholder="e.g. Attend at least 30 classes" />
            </div>
            <div className="form-group">
              <label>Value (numeric threshold)</label>
              <input className="form-control" type="number" min="0" value={reqForm.value} onChange={e => setReqForm({ ...reqForm, value: e.target.value })} placeholder="e.g. 30" />
            </div>
            <div className="form-group">
              <label>
                <input type="checkbox" checked={reqForm.isRequired} onChange={e => setReqForm({ ...reqForm, isRequired: e.target.checked })} />
                {' '}Required for promotion
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSaveReq}>Add Requirement</button>
              <button className="btn btn-outline" onClick={() => setShowReqModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Enrollments Tab ──────────────────────────────────────

function EnrollmentsTab({ schoolId }) {
  const { isSuperAdmin, isOwner, isInstructor } = useAuth();
  const canEnroll = isSuperAdmin || isOwner || isInstructor;
  const [enrollments, setEnrollments] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [enrollForm, setEnrollForm] = useState({ studentId: '', programId: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [enr, progs, studs] = await Promise.all([
        promotionApi.getEnrollments(schoolId),
        promotionApi.getPrograms({ schoolId }),
        enrollmentApi.getSchoolStudents(schoolId),
      ]);
      setEnrollments(enr);
      setPrograms(progs);
      setStudents(studs);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleEnroll = async () => {
    try {
      await promotionApi.createEnrollment(schoolId, enrollForm);
      setShowModal(false);
      fetchData();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      {canEnroll && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={() => { setEnrollForm({ studentId: '', programId: '' }); setShowModal(true); }}>+ Enroll Student in Program</button>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Program Enrollments</h2></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Student</th><th>Program</th><th>Current Belt</th><th>Enrolled</th></tr>
            </thead>
            <tbody>
              {enrollments.length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center' }}>No enrollments yet</td></tr>
              ) : enrollments.map(e => (
                <tr key={e.id}>
                  <td>{e.student?.firstName} {e.student?.lastName}</td>
                  <td>{e.program?.name} {e.program?.isGlobal && '🌐'}</td>
                  <td>
                    {e.currentBelt ? (
                      <span>
                        <span style={{ display: 'inline-block', width: 14, height: 14, backgroundColor: e.currentBelt.color || '#ccc', borderRadius: 3, marginRight: 6, verticalAlign: 'middle', border: '1px solid #555' }} />
                        {e.currentBelt.name}
                      </span>
                    ) : <span style={{ color: '#888' }}>No rank yet</span>}
                  </td>
                  <td>{new Date(e.enrolledAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Enroll Student in Program</h3>
            <div className="form-group">
              <label>Student *</label>
              <select className="form-control" value={enrollForm.studentId} onChange={e => setEnrollForm({ ...enrollForm, studentId: e.target.value })}>
                <option value="">Select student...</option>
                {students.map(s => <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Program *</label>
              <select className="form-control" value={enrollForm.programId} onChange={e => setEnrollForm({ ...enrollForm, programId: e.target.value })}>
                <option value="">Select program...</option>
                {programs.map(p => <option key={p.id} value={p.id}>{p.name}{p.isGlobal ? ' 🌐' : ''}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleEnroll} disabled={!enrollForm.studentId || !enrollForm.programId}>Enroll</button>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student Progress Tab (Staff view) ────────────────────

function ProgressTab({ schoolId }) {
  const { isSuperAdmin, isOwner, isInstructor } = useAuth();
  const canPromote = isSuperAdmin || isOwner || isInstructor;
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState(null);
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchEnrollments = useCallback(() => {
    setLoading(true);
    promotionApi.getEnrollments(schoolId)
      .then(data => {
        setEnrollments(data);
        if (data.length && !selectedEnrollment) setSelectedEnrollment(data[0]);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [schoolId]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const fetchProgress = useCallback(() => {
    if (!selectedEnrollment) return;
    promotionApi.getProgress(selectedEnrollment.id)
      .then(setProgress)
      .catch(err => setError(err.message));
  }, [selectedEnrollment?.id]);

  useEffect(() => { fetchProgress(); }, [fetchProgress]);

  const handleUpdateProgress = async (requirementId, currentValue, isComplete) => {
    try {
      await promotionApi.updateProgress(selectedEnrollment.id, { requirementId, currentValue, isComplete });
      fetchProgress();
    } catch (err) { setError(err.message); }
  };

  const handlePromote = async () => {
    if (!window.confirm(`Promote ${progress?.enrollment?.student?.firstName} to ${progress?.nextBelt?.name}?`)) return;
    try {
      await promotionApi.promoteStudent(selectedEnrollment.id, { notes: 'Promoted via one-click' });
      fetchProgress();
      fetchEnrollments();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      {/* Student selector */}
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label><strong>Student:</strong></label>
        <select className="form-control" style={{ width: 'auto', minWidth: '280px' }} value={selectedEnrollment?.id || ''} onChange={e => {
          setSelectedEnrollment(enrollments.find(x => x.id === e.target.value));
          setProgress(null);
        }}>
          {enrollments.map(e => (
            <option key={e.id} value={e.id}>{e.student?.firstName} {e.student?.lastName} — {e.program?.name}</option>
          ))}
        </select>
      </div>

      {progress && (
        <>
          {/* Belt journey */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header"><h3>Belt Journey — {progress.enrollment?.program?.name}</h3></div>
            <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {progress.allBelts?.map((b, idx) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    backgroundColor: b.isAchieved ? (b.color || '#ccc') : '#2a2a3a',
                    color: b.isAchieved ? '#000' : '#666',
                    border: b.isCurrent ? '3px solid #f1c40f' : '1px solid #444',
                    fontWeight: b.isCurrent ? 'bold' : 'normal',
                    fontSize: '0.9em',
                    opacity: b.isAchieved ? 1 : 0.5,
                  }}>
                    {b.name}
                    {b.isCurrent && ' ★'}
                  </div>
                  {idx < progress.allBelts.length - 1 && <span style={{ color: '#666' }}>→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Requirements for next belt */}
          {progress.nextBelt && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0 }}>
                  Requirements for: <span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: progress.nextBelt.color || '#ccc', borderRadius: 3, marginLeft: 6, marginRight: 4, verticalAlign: 'middle', border: '1px solid #555' }} />
                  {progress.nextBelt.name}
                </h3>
                {canPromote && progress.readyForPromotion && (
                  <button className="btn btn-primary" onClick={handlePromote}>
                    🎉 Promote to {progress.nextBelt.name}
                  </button>
                )}
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>Type</th><th>Description</th><th>Target</th><th>Progress</th><th>Complete</th>{canPromote && <th>Update</th>}</tr>
                  </thead>
                  <tbody>
                    {progress.requirements.map(r => (
                      <tr key={r.id}>
                        <td><span className="badge">{r.type.replace(/_/g, ' ')}</span></td>
                        <td>{r.description}</td>
                        <td>{r.value ?? '—'}</td>
                        <td>
                          {r.value ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <div style={{ flex: 1, height: 8, backgroundColor: '#333', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, (r.currentValue / r.value) * 100)}%`, height: '100%', backgroundColor: r.isComplete ? '#2ecc71' : '#3498db', borderRadius: 4 }} />
                              </div>
                              <span style={{ fontSize: '0.85em' }}>{r.currentValue}/{r.value}</span>
                            </div>
                          ) : (r.isComplete ? '✅' : '⬜')}
                        </td>
                        <td>{r.isComplete ? '✅' : '⬜'}</td>
                        {canPromote && (
                          <td>
                            {r.type !== 'ESSAY' ? (
                              <div style={{ display: 'flex', gap: '0.25rem' }}>
                                <input
                                  type="number"
                                  min="0"
                                  style={{ width: 60 }}
                                  className="form-control"
                                  defaultValue={r.currentValue}
                                  onBlur={e => {
                                    const val = parseFloat(e.target.value);
                                    const complete = r.value ? val >= r.value : false;
                                    handleUpdateProgress(r.id, val, complete);
                                  }}
                                />
                                <button className="btn btn-sm btn-outline" onClick={() => handleUpdateProgress(r.id, r.value || r.currentValue, true)} title="Mark complete">✓</button>
                              </div>
                            ) : (
                              <span style={{ color: '#888', fontSize: '0.85em' }}>See Essays tab</span>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {progress.readyForPromotion && (
                <div style={{ padding: '1rem', textAlign: 'center', color: '#2ecc71', fontWeight: 'bold' }}>
                  🎉 All required requirements met — Ready for promotion!
                </div>
              )}
            </div>
          )}

          {!progress.nextBelt && progress.enrollment?.currentBelt && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <h2>🏆 Highest Rank Achieved!</h2>
              <p>{progress.enrollment.student?.firstName} has reached the top rank in {progress.enrollment.program?.name}.</p>
            </div>
          )}

          {/* Promotion history */}
          {progress.promotionHistory?.length > 0 && (
            <div className="card">
              <div className="card-header"><h3>Promotion History</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Date</th><th>From</th><th>To</th><th>Promoted By</th><th>Notes</th></tr></thead>
                  <tbody>
                    {progress.promotionHistory.map(p => (
                      <tr key={p.id}>
                        <td>{new Date(p.promotedAt).toLocaleDateString()}</td>
                        <td>{p.fromBelt?.name || '—'}</td>
                        <td>
                          <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: p.toBelt?.color || '#ccc', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #555' }} />
                          {p.toBelt?.name}
                        </td>
                        <td>{p.promotedBy?.firstName} {p.promotedBy?.lastName}</td>
                        <td>{p.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Tests Tab ────────────────────────────────────────────

function TestsTab({ schoolId }) {
  const { isSuperAdmin, isOwner, isInstructor } = useAuth();
  const canManage = isSuperAdmin || isOwner || isInstructor;
  const [tests, setTests] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [testForm, setTestForm] = useState({ programEnrollmentId: '', beltId: '', testDate: '' });
  const [programs, setPrograms] = useState([]);
  const [selectedProgramBelts, setSelectedProgramBelts] = useState([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [t, e, p] = await Promise.all([
        promotionApi.getTests(schoolId),
        promotionApi.getEnrollments(schoolId),
        promotionApi.getPrograms({ schoolId }),
      ]);
      setTests(t);
      setEnrollments(e);
      setPrograms(p);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSchedule = async () => {
    try {
      await promotionApi.createTest(testForm);
      setShowModal(false);
      fetchData();
    } catch (err) { setError(err.message); }
  };

  const handleStatus = async (testId, status, score) => {
    try {
      await promotionApi.updateTest(testId, { status, score });
      fetchData();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      {canManage && (
        <div style={{ marginBottom: '1rem' }}>
          <button className="btn btn-primary" onClick={() => {
            setTestForm({ programEnrollmentId: '', beltId: '', testDate: new Date().toISOString().split('T')[0] });
            setShowModal(true);
          }}>+ Schedule Test</button>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h2>Belt Tests</h2></div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr><th>Date</th><th>Student</th><th>Program</th><th>Target Belt</th><th>Status</th><th>Score</th>{canManage && <th>Actions</th>}</tr>
            </thead>
            <tbody>
              {tests.length === 0 ? (
                <tr><td colSpan={canManage ? 7 : 6} style={{ textAlign: 'center' }}>No tests scheduled</td></tr>
              ) : tests.map(t => (
                <tr key={t.id}>
                  <td>{new Date(t.testDate).toLocaleDateString()}</td>
                  <td>{t.enrollment?.student?.firstName} {t.enrollment?.student?.lastName}</td>
                  <td>{t.enrollment?.program?.name}</td>
                  <td>
                    <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: t.belt?.color || '#ccc', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #555' }} />
                    {t.belt?.name}
                  </td>
                  <td><span className={`badge ${t.status === 'PASSED' ? 'badge-success' : t.status === 'FAILED' ? 'badge-danger' : ''}`}>{t.status}</span></td>
                  <td>{t.score != null ? `${t.score}%` : '—'}</td>
                  {canManage && (
                    <td>
                      {t.status === 'SCHEDULED' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-sm btn-outline" onClick={() => handleStatus(t.id, 'IN_PROGRESS')}>Start</button>
                        </div>
                      )}
                      {t.status === 'IN_PROGRESS' && (
                        <div style={{ display: 'flex', gap: '0.25rem' }}>
                          <button className="btn btn-sm" style={{ backgroundColor: '#2ecc71', color: '#fff' }} onClick={() => {
                            const score = prompt('Enter score (0-100):', '85');
                            if (score !== null) handleStatus(t.id, 'PASSED', score);
                          }}>Pass</button>
                          <button className="btn btn-sm" style={{ backgroundColor: '#e74c3c', color: '#fff' }} onClick={() => handleStatus(t.id, 'FAILED')}>Fail</button>
                        </div>
                      )}
                      {(t.status === 'PASSED' || t.status === 'FAILED') && <span style={{ color: '#888' }}>Completed</span>}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Schedule Belt Test</h3>
            <div className="form-group">
              <label>Student Enrollment *</label>
              <select className="form-control" value={testForm.programEnrollmentId} onChange={e => {
                const enr = enrollments.find(x => x.id === e.target.value);
                setTestForm({ ...testForm, programEnrollmentId: e.target.value, beltId: '' });
                if (enr) {
                  const prog = programs.find(p => p.id === enr.program?.id);
                  setSelectedProgramBelts(prog?.belts || []);
                }
              }}>
                <option value="">Select…</option>
                {enrollments.map(e => <option key={e.id} value={e.id}>{e.student?.firstName} {e.student?.lastName} — {e.program?.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Target Belt *</label>
              <select className="form-control" value={testForm.beltId} onChange={e => setTestForm({ ...testForm, beltId: e.target.value })}>
                <option value="">Select…</option>
                {selectedProgramBelts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Test Date *</label>
              <input type="date" className="form-control" value={testForm.testDate} onChange={e => setTestForm({ ...testForm, testDate: e.target.value })} />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSchedule} disabled={!testForm.programEnrollmentId || !testForm.beltId}>Schedule</button>
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Essays Tab ───────────────────────────────────────────

function EssaysTab({ schoolId }) {
  const { isSuperAdmin, isOwner, isInstructor } = useAuth();
  const canReview = isSuperAdmin || isOwner || isInstructor;
  const [enrollments, setEnrollments] = useState([]);
  const [selectedEnrollmentId, setSelectedEnrollmentId] = useState('');
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showReview, setShowReview] = useState(null);
  const [reviewForm, setReviewForm] = useState({ score: '', feedback: '' });

  const fetchEnrollments = useCallback(async () => {
    setLoading(true);
    try {
      const data = await promotionApi.getEnrollments(schoolId);
      setEnrollments(data);
      if (data.length) setSelectedEnrollmentId(data[0].id);
    } catch (err) { setError(err.message); }
    setLoading(false);
  }, [schoolId]);

  useEffect(() => { fetchEnrollments(); }, [fetchEnrollments]);

  const fetchEssays = useCallback(() => {
    if (!selectedEnrollmentId) return;
    promotionApi.getEssays(selectedEnrollmentId)
      .then(setEssays)
      .catch(err => setError(err.message));
  }, [selectedEnrollmentId]);

  useEffect(() => { fetchEssays(); }, [fetchEssays]);

  const handleReview = async () => {
    try {
      await promotionApi.reviewEssay(showReview.id, reviewForm);
      setShowReview(null);
      fetchEssays();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <label><strong>Student:</strong></label>
        <select className="form-control" style={{ width: 'auto', minWidth: '280px' }} value={selectedEnrollmentId} onChange={e => setSelectedEnrollmentId(e.target.value)}>
          {enrollments.map(e => <option key={e.id} value={e.id}>{e.student?.firstName} {e.student?.lastName} — {e.program?.name}</option>)}
        </select>
      </div>

      <div className="card">
        <div className="card-header"><h2>Essay Submissions</h2></div>
        {essays.length === 0 ? (
          <div style={{ padding: '1rem', textAlign: 'center', color: '#888' }}>No essays submitted yet</div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Submitted</th><th>Title</th><th>Test</th><th>Score</th><th>Reviewer</th><th>Status</th>{canReview && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {essays.map(e => (
                  <tr key={e.id}>
                    <td>{new Date(e.submittedAt).toLocaleDateString()}</td>
                    <td>{e.title || '(Untitled)'}</td>
                    <td>{e.test?.belt?.name || '—'}</td>
                    <td>{e.score != null ? `${e.score}%` : '—'}</td>
                    <td>{e.reviewedBy ? `${e.reviewedBy.firstName} ${e.reviewedBy.lastName}` : '—'}</td>
                    <td><span className={`badge ${e.reviewedAt ? 'badge-success' : 'badge-warning'}`}>{e.reviewedAt ? 'Reviewed' : 'Pending'}</span></td>
                    {canReview && (
                      <td>
                        <button className="btn btn-sm btn-outline" onClick={() => {
                          setShowReview(e);
                          setReviewForm({ score: e.score || '', feedback: e.feedback || '' });
                        }}>{e.reviewedAt ? 'Re-review' : 'Review'}</button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showReview && (
        <div className="modal-backdrop" onClick={() => setShowReview(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3>Review Essay: {showReview.title || '(Untitled)'}</h3>
            <div style={{ maxHeight: 200, overflowY: 'auto', padding: '0.75rem', backgroundColor: '#1a1a2e', borderRadius: 8, marginBottom: '1rem', whiteSpace: 'pre-wrap', fontSize: '0.9em' }}>
              {showReview.content}
            </div>
            <div className="form-group">
              <label>Score (0–100)</label>
              <input type="number" min="0" max="100" className="form-control" value={reviewForm.score} onChange={e => setReviewForm({ ...reviewForm, score: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Feedback</label>
              <textarea className="form-control" value={reviewForm.feedback} onChange={e => setReviewForm({ ...reviewForm, feedback: e.target.value })} rows={3} placeholder="Notes for the student..." />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleReview}>Save Review</button>
              <button className="btn btn-outline" onClick={() => setShowReview(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Student "My Progress" Tab ────────────────────────────

function StudentMyProgress() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [progress, setProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user?.schoolId) return;
    setLoading(true);
    promotionApi.getEnrollments(user.schoolId, { studentId: user.id })
      .then(data => {
        setEnrollments(data);
        if (data.length) setSelectedId(data[0].id);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  useEffect(() => {
    if (!selectedId) return;
    promotionApi.getProgress(selectedId).then(setProgress).catch(err => setError(err.message));
  }, [selectedId]);

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (enrollments.length === 0) return <div className="alert">You are not enrolled in any programs yet.</div>;

  return (
    <div>
      {enrollments.length > 1 && (
        <div style={{ marginBottom: '1rem' }}>
          <select className="form-control" style={{ width: 'auto', minWidth: '250px' }} value={selectedId} onChange={e => { setSelectedId(e.target.value); setProgress(null); }}>
            {enrollments.map(e => <option key={e.id} value={e.id}>{e.program?.name}</option>)}
          </select>
        </div>
      )}

      {progress && (
        <>
          {/* Belt journey visual */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header"><h2>Your Belt Journey — {progress.enrollment?.program?.name}</h2></div>
            <div style={{ padding: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              {progress.allBelts?.map((b, idx) => (
                <div key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  <div style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    backgroundColor: b.isAchieved ? (b.color || '#ccc') : '#2a2a3a',
                    color: b.isAchieved ? '#000' : '#666',
                    border: b.isCurrent ? '3px solid #f1c40f' : '1px solid #444',
                    fontWeight: b.isCurrent ? 'bold' : 'normal',
                    fontSize: '0.9em',
                    opacity: b.isAchieved ? 1 : 0.5,
                  }}>
                    {b.name} {b.isCurrent && '★'}
                  </div>
                  {idx < progress.allBelts.length - 1 && <span style={{ color: '#666' }}>→</span>}
                </div>
              ))}
            </div>
          </div>

          {/* Next belt requirements */}
          {progress.nextBelt ? (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <div className="card-header">
                <h2>
                  Next: <span style={{ display: 'inline-block', width: 16, height: 16, backgroundColor: progress.nextBelt.color || '#ccc', borderRadius: 3, marginLeft: 6, marginRight: 4, verticalAlign: 'middle', border: '1px solid #555' }} />
                  {progress.nextBelt.name}
                </h2>
              </div>
              {progress.requirements.length > 0 ? (
                <div style={{ padding: '1rem' }}>
                  {progress.requirements.map(r => (
                    <div key={r.id} style={{ marginBottom: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <span><span className="badge" style={{ marginRight: 8 }}>{r.type.replace(/_/g, ' ')}</span>{r.description}</span>
                        <span>{r.isComplete ? '✅' : r.value ? `${r.currentValue}/${r.value}` : '⬜'}</span>
                      </div>
                      {r.value && (
                        <div style={{ height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, (r.currentValue / r.value) * 100)}%`, height: '100%', backgroundColor: r.isComplete ? '#2ecc71' : '#3498db', borderRadius: 5, transition: 'width 0.3s' }} />
                        </div>
                      )}
                    </div>
                  ))}
                  {progress.readyForPromotion && (
                    <div style={{ textAlign: 'center', padding: '1rem', color: '#2ecc71', fontWeight: 'bold', fontSize: '1.2em' }}>
                      🎉 You've met all requirements! Talk to your Sifu about promotion.
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '1rem', color: '#888' }}>No specific requirements listed for this belt.</div>
              )}
            </div>
          ) : progress.enrollment?.currentBelt && (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <h2>🏆 You've reached the highest rank!</h2>
              <p>Congratulations on achieving the top belt in {progress.enrollment.program?.name}.</p>
            </div>
          )}

          {/* Promotion history */}
          {progress.promotionHistory?.length > 0 && (
            <div className="card">
              <div className="card-header"><h2>Your Promotion History</h2></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Date</th><th>From</th><th>To</th><th>Promoted By</th></tr></thead>
                  <tbody>
                    {progress.promotionHistory.map(p => (
                      <tr key={p.id}>
                        <td>{new Date(p.promotedAt).toLocaleDateString()}</td>
                        <td>{p.fromBelt?.name || '—'}</td>
                        <td>
                          <span style={{ display: 'inline-block', width: 12, height: 12, backgroundColor: p.toBelt?.color || '#ccc', borderRadius: 3, marginRight: 4, verticalAlign: 'middle', border: '1px solid #555' }} />
                          {p.toBelt?.name}
                        </td>
                        <td>{p.promotedBy?.firstName} {p.promotedBy?.lastName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Student "My Essays" Tab ──────────────────────────────

function StudentMyEssays() {
  const { user } = useAuth();
  const [enrollments, setEnrollments] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [essays, setEssays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSubmit, setShowSubmit] = useState(false);
  const [form, setForm] = useState({ title: '', content: '' });

  useEffect(() => {
    if (!user?.schoolId) return;
    setLoading(true);
    promotionApi.getEnrollments(user.schoolId, { studentId: user.id })
      .then(data => {
        setEnrollments(data);
        if (data.length) setSelectedId(data[0].id);
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [user]);

  const fetchEssays = useCallback(() => {
    if (!selectedId) return;
    promotionApi.getEssays(selectedId).then(setEssays).catch(err => setError(err.message));
  }, [selectedId]);

  useEffect(() => { fetchEssays(); }, [fetchEssays]);

  const handleSubmit = async () => {
    try {
      await promotionApi.submitEssay({ programEnrollmentId: selectedId, ...form });
      setShowSubmit(false);
      setForm({ title: '', content: '' });
      fetchEssays();
    } catch (err) { setError(err.message); }
  };

  if (loading) return <div className="loading">Loading...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;
  if (enrollments.length === 0) return <div className="alert">You are not enrolled in any programs.</div>;

  return (
    <div>
      <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        {enrollments.length > 1 && (
          <select className="form-control" style={{ width: 'auto', minWidth: '250px' }} value={selectedId} onChange={e => setSelectedId(e.target.value)}>
            {enrollments.map(e => <option key={e.id} value={e.id}>{e.program?.name}</option>)}
          </select>
        )}
        <button className="btn btn-primary" onClick={() => { setForm({ title: '', content: '' }); setShowSubmit(true); }}>+ Submit Essay</button>
      </div>

      {essays.length === 0 ? (
        <div className="card" style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>No essays submitted yet. Click "+ Submit Essay" to get started.</div>
      ) : (
        essays.map(e => (
          <div key={e.id} className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
              <h3 style={{ margin: 0 }}>{e.title || '(Untitled)'}</h3>
              <span style={{ fontSize: '0.85em', color: '#888' }}>{new Date(e.submittedAt).toLocaleDateString()}</span>
            </div>
            <div style={{ padding: '0.75rem 1rem', whiteSpace: 'pre-wrap', maxHeight: 200, overflowY: 'auto', fontSize: '0.9em' }}>
              {e.content}
            </div>
            <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #333', display: 'flex', gap: '1rem' }}>
              <span><strong>Score:</strong> {e.score != null ? `${e.score}%` : 'Pending'}</span>
              <span><strong>Reviewer:</strong> {e.reviewedBy ? `${e.reviewedBy.firstName} ${e.reviewedBy.lastName}` : 'Pending'}</span>
            </div>
            {e.feedback && (
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid #333', backgroundColor: '#1a1a2e', borderRadius: '0 0 8px 8px' }}>
                <strong>Feedback:</strong> {e.feedback}
              </div>
            )}
          </div>
        ))
      )}

      {showSubmit && (
        <div className="modal-backdrop" onClick={() => setShowSubmit(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <h3>Submit Essay</h3>
            <div className="form-group">
              <label>Title</label>
              <input className="form-control" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Essay title (optional)" />
            </div>
            <div className="form-group">
              <label>Essay Content *</label>
              <textarea className="form-control" value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} rows={10} placeholder="Write your essay here..." />
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
              <button className="btn btn-primary" onClick={handleSubmit} disabled={!form.content.trim()}>Submit</button>
              <button className="btn btn-outline" onClick={() => setShowSubmit(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
