import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { classInstanceApi, programApi, checkInApi } from '../api/client';

// Convert 24h "HH:mm" to 12h "h:mm AM/PM"
const formatTime12h = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export default function ClassesPage() {
  const { isStaff } = useAuth();
  const [classes, setClasses] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedClass, setSelectedClass] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [collapsedPrograms, setCollapsedPrograms] = useState({});
  const [form, setForm] = useState({
    programOfferingId: '',
    classDate: new Date().toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '19:30',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [classesData, programsData] = await Promise.all([
        classInstanceApi.getAll(),
        programApi.getAll(),
      ]);
      setClasses(classesData);
      setPrograms(programsData);
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
      await classInstanceApi.create(form);
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await classInstanceApi.updateStatus(id, status);
      fetchData();
      if (selectedClass?.id === id) {
        viewAttendance(id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const viewAttendance = async (classId) => {
    try {
      const data = await checkInApi.getAttendance(classId);
      setAttendance(data);
      setSelectedClass(classes.find((c) => c.id === classId) || null);
      setShowDetailModal(true);
    } catch (err) {
      setError(err.message);
    }
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  // Group classes by program curriculum
  const groupedClasses = useMemo(() => {
    const groups = {};
    classes.forEach((cls) => {
      const programName = cls.class?.program?.name || cls.class?.discipline || 'Uncategorized';
      if (!groups[programName]) {
        groups[programName] = [];
      }
      groups[programName].push(cls);
    });
    // Sort classes within each group by date
    Object.values(groups).forEach((arr) => {
      arr.sort((a, b) => new Date(a.sessionDate) - new Date(b.sessionDate));
    });
    return groups;
  }, [classes]);

  const toggleProgram = (program) => {
    setCollapsedPrograms((prev) => ({ ...prev, [program]: !prev[program] }));
  };

  if (loading) return <div className="loading">Loading classes...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Classes</h1>
        {isStaff && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Class
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Grouped Classes by Program */}
      {classes.length === 0 ? (
        <div className="card">
          <p style={{ color: 'var(--color-text-light)' }}>No classes found. Add program schedules to auto-generate classes.</p>
        </div>
      ) : (
        Object.entries(groupedClasses).map(([programName, programClasses]) => (
          <div key={programName} className="card" style={{ marginBottom: '1rem' }}>
            {/* Program Header - Collapsible */}
            <div
              onClick={() => toggleProgram(programName)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                padding: '0.75rem 0',
                borderBottom: collapsedPrograms[programName] ? 'none' : '1px solid #e0e0e0',
                marginBottom: collapsedPrograms[programName] ? 0 : '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <span style={{ fontSize: '1.2rem' }}>{collapsedPrograms[programName] ? '▶' : '▼'}</span>
                <h3 style={{ margin: 0 }}>🥋 {programName}</h3>
                <span className="badge badge-scheduled" style={{ fontSize: '0.75rem' }}>
                  {programClasses.length} class{programClasses.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <span style={{ color: '#888', fontSize: '0.85rem' }}>
                {programClasses.filter((c) => c.status === 'SCHEDULED').length} upcoming
              </span>
            </div>

            {/* Classes Table - Collapsible */}
            {!collapsedPrograms[programName] && (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Program</th>
                      <th>Time</th>
                      <th>Instructor</th>
                      <th>Attendance</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {programClasses.map((cls) => (
                      <tr key={cls.id}>
                        <td>{formatDate(cls.sessionDate)}</td>
                        <td><strong>{cls.class?.name}</strong></td>
                        <td>{formatTime12h(cls.startTime)} - {formatTime12h(cls.endTime)}</td>
                        <td>{cls.class?.instructor?.firstName} {cls.class?.instructor?.lastName}</td>
                        <td>{cls._count?.checkIns || 0} / {cls.class?.capacity || '?'}</td>
                        <td>
                          <span className={`badge badge-${cls.status.toLowerCase().replace('_', '-')}`}>
                            {cls.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => viewAttendance(cls.id)}
                          >
                            View
                          </button>
                          {isStaff && cls.status === 'SCHEDULED' && (
                            <button
                              className="btn btn-success btn-sm"
                              style={{ marginLeft: '0.5rem' }}
                              onClick={() => handleStatusChange(cls.id, 'IN_PROGRESS')}
                            >
                              Start
                            </button>
                          )}
                          {isStaff && cls.status === 'IN_PROGRESS' && (
                            <button
                              className="btn btn-secondary btn-sm"
                              style={{ marginLeft: '0.5rem' }}
                              onClick={() => handleStatusChange(cls.id, 'COMPLETED')}
                            >
                              Complete
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
        ))
      )}

      {/* Create Class Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowCreateModal(false); }}>
          <div className="modal">
            <h2>Create Class</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Program</label>
                <select name="programOfferingId" className="form-control" value={form.programOfferingId} onChange={handleChange} required>
                  <option value="">Select a program...</option>
                  {programs.map((prog) => (
                    <option key={prog.id} value={prog.id}>
                      {prog.name} — {prog.program?.name || prog.discipline}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="classDate" className="form-control" value={form.classDate} onChange={handleChange} required />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Start Time</label>
                  <input type="time" name="startTime" className="form-control" value={form.startTime} onChange={handleChange} required />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input type="time" name="endTime" className="form-control" value={form.endTime} onChange={handleChange} required />
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Create Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Detail Modal */}
      {showDetailModal && attendance && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowDetailModal(false); }}>
          <div className="modal">
            <h2>Attendance — {attendance.class.name}</h2>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1rem' }}>
              {attendance.class.program?.name || attendance.class.discipline} · {formatDate(attendance.session.date)} · {formatTime12h(attendance.session.startTime)}-{formatTime12h(attendance.session.endTime)}
            </p>

            <div className="stats-grid" style={{ marginBottom: '1rem' }}>
              <div className="stat-card">
                <div className="stat-value">{attendance.attendance.total}</div>
                <div className="stat-label">Checked In</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{attendance.attendance.capacity}</div>
                <div className="stat-label">Capacity</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{attendance.attendance.spotsRemaining}</div>
                <div className="stat-label">Spots Left</div>
              </div>
            </div>

            {attendance.attendance.students.length === 0 ? (
              <p style={{ color: 'var(--color-text-light)', textAlign: 'center' }}>No students checked in yet.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Method</th>
                      <th>Time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendance.attendance.students.map((s) => (
                      <tr key={s.checkInId}>
                        <td>{s.student.firstName} {s.student.lastName}</td>
                        <td><span className="badge badge-scheduled">{s.method}</span></td>
                        <td>{new Date(s.checkedInAt).toLocaleTimeString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="modal-actions">
              <button className="btn btn-outline" onClick={() => setShowDetailModal(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
