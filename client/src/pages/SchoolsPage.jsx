import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { schoolApi, userApi, enrollmentApi } from '../api/client';
import { displayRole } from '../utils/displayRole';

export default function SchoolsPage() {
  const { isSuperAdmin, isOwner } = useAuth();
  const [schools, setSchools] = useState([]);
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState('');
  const [form, setForm] = useState({
    name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', ownerId: '',
  });

  useEffect(() => {
    fetchSchools();
    if (isSuperAdmin) {
      userApi.getAll({ role: 'OWNER' }).then(setOwners).catch(() => {});
    }
  }, [isSuperAdmin]);

  const fetchSchools = async () => {
    try {
      const data = await schoolApi.getAll();
      setSchools(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await schoolApi.create(form);
      setShowModal(false);
      setForm({ name: '', address: '', city: '', state: '', zip: '', phone: '', email: '', ownerId: '' });
      fetchSchools();
    } catch (err) {
      setError(err.message);
    }
  };

  const viewSchool = async (schoolId) => {
    try {
      const school = await schoolApi.getById(schoolId);
      setSelectedSchool(school);
      setShowDetailModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const openEnrollModal = async (school) => {
    setSelectedSchool(school);
    try {
      const allStudents = await userApi.getAll({ role: 'STUDENT' });
      setStudents(allStudents);
      setShowEnrollModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleEnroll = async () => {
    if (!selectedStudent || !selectedSchool) return;
    try {
      await enrollmentApi.enroll(selectedStudent, selectedSchool.id);
      setShowEnrollModal(false);
      setSelectedStudent('');
      viewSchool(selectedSchool.id);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading schools...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Schools</h1>
        {isSuperAdmin && (
          <button className="btn btn-primary" onClick={() => setShowModal(true)}>
            + New School
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{schools.length}</div>
          <div className="stat-label">Active Schools</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{schools.reduce((sum, s) => sum + (s._count?.enrollments || 0), 0)}</div>
          <div className="stat-label">Total Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{schools.reduce((sum, s) => sum + (s._count?.classes || 0), 0)}</div>
          <div className="stat-label">Total Classes</div>
        </div>
      </div>

      <div className="card">
        {schools.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>No schools yet.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>Owner</th>
                  <th>Location</th>
                  <th>Classes</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id}>
                    <td><strong>{school.name}</strong></td>
                    <td>{school.owner?.firstName} {school.owner?.lastName}</td>
                    <td>{[school.city, school.state].filter(Boolean).join(', ') || '—'}</td>
                    <td>{school._count?.classes || 0}</td>
                    <td>{school._count?.enrollments || 0}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" onClick={() => viewSchool(school.id)}>
                        View
                      </button>
                      {(isSuperAdmin || isOwner) && (
                        <button
                          className="btn btn-success btn-sm"
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => openEnrollModal(school)}
                        >
                          Enroll
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create School Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>New School</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>School Name</label>
                <input type="text" name="name" className="form-control" value={form.name} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Owner</label>
                <select name="ownerId" className="form-control" value={form.ownerId} onChange={handleChange} required>
                  <option value="">Select owner...</option>
                  {owners.map((o) => (
                    <option key={o.id} value={o.id}>{o.firstName} {o.lastName} ({o.email})</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Address</label>
                <input type="text" name="address" className="form-control" value={form.address} onChange={handleChange} />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>City</label>
                  <input type="text" name="city" className="form-control" value={form.city} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>State</label>
                  <input type="text" name="state" className="form-control" value={form.state} onChange={handleChange} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Zip</label>
                  <input type="text" name="zip" className="form-control" value={form.zip} onChange={handleChange} />
                </div>
                <div className="form-group">
                  <label>Phone</label>
                  <input type="text" name="phone" className="form-control" value={form.phone} onChange={handleChange} />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input type="email" name="email" className="form-control" value={form.email} onChange={handleChange} />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create School</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* School Detail Modal */}
      {showDetailModal && selectedSchool && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '640px' }}>
            <h2>{selectedSchool.name}</h2>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1rem' }}>
              Owned by {selectedSchool.owner?.firstName} {selectedSchool.owner?.lastName}
              {selectedSchool.city && ` · ${selectedSchool.city}, ${selectedSchool.state}`}
            </p>

            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card">
                <div className="stat-value">{selectedSchool.classes?.length || 0}</div>
                <div className="stat-label">Classes</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{selectedSchool._count?.enrollments || 0}</div>
                <div className="stat-label">Students</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{selectedSchool.staff?.length || 0}</div>
                <div className="stat-label">Staff</div>
              </div>
            </div>

            {selectedSchool.classes?.length > 0 && (
              <>
                <h3 style={{ marginBottom: '0.5rem' }}>Classes</h3>
                <div className="table-wrapper" style={{ marginBottom: '1rem' }}>
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Discipline</th><th>Instructor</th><th>Sessions</th></tr>
                    </thead>
                    <tbody>
                      {selectedSchool.classes.map((cls) => (
                        <tr key={cls.id}>
                          <td>{cls.name}</td>
                          <td>{cls.discipline}</td>
                          <td>{cls.instructor?.firstName} {cls.instructor?.lastName}</td>
                          <td>{cls._count?.sessions || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {selectedSchool.staff?.length > 0 && (
              <>
                <h3 style={{ marginBottom: '0.5rem' }}>Staff</h3>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr><th>Name</th><th>Email</th><th>Role</th></tr>
                    </thead>
                    <tbody>
                      {selectedSchool.staff.map((s) => (
                        <tr key={s.id}>
                          <td>{s.firstName} {s.lastName}</td>
                          <td>{s.email}</td>
                          <td><span className={`badge badge-${s.role.toLowerCase()}`}>{displayRole(s.role)}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Enroll Student Modal */}
      {showEnrollModal && (
        <div className="modal-overlay" onClick={() => setShowEnrollModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Enroll Student at {selectedSchool?.name}</h2>
            <div className="form-group">
              <label>Select Student</label>
              <select className="form-control" value={selectedStudent} onChange={(e) => setSelectedStudent(e.target.value)}>
                <option value="">Choose a student...</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>{s.firstName} {s.lastName} ({s.email})</option>
                ))}
              </select>
            </div>
            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowEnrollModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleEnroll}>Enroll Student</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
