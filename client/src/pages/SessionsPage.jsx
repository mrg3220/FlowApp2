import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { sessionApi, classApi, checkInApi } from '../api/client';

export default function SessionsPage() {
  const { isStaff } = useAuth();
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    classId: '',
    sessionDate: new Date().toISOString().split('T')[0],
    startTime: '18:00',
    endTime: '19:30',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [sessionsData, classesData] = await Promise.all([
        sessionApi.getAll(),
        classApi.getAll(),
      ]);
      setSessions(sessionsData);
      setClasses(classesData);
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
      await sessionApi.create(form);
      setShowCreateModal(false);
      fetchData();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await sessionApi.updateStatus(id, status);
      fetchData();
      if (selectedSession?.id === id) {
        viewAttendance(id);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  const viewAttendance = async (sessionId) => {
    try {
      const data = await checkInApi.getAttendance(sessionId);
      setAttendance(data);
      setSelectedSession(sessions.find((s) => s.id === sessionId) || null);
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

  if (loading) return <div className="loading">Loading sessions...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Sessions</h1>
        {isStaff && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + New Session
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {sessions.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>No sessions found.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Class</th>
                  <th>Time</th>
                  <th>Instructor</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td>{formatDate(session.sessionDate)}</td>
                    <td><strong>{session.class.name}</strong></td>
                    <td>{session.startTime} - {session.endTime}</td>
                    <td>{session.class.instructor?.firstName} {session.class.instructor?.lastName}</td>
                    <td>{session._count?.checkIns || 0} / {session.class.capacity}</td>
                    <td>
                      <span className={`badge badge-${session.status.toLowerCase().replace('_', '-')}`}>
                        {session.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => viewAttendance(session.id)}
                      >
                        View
                      </button>
                      {isStaff && session.status === 'SCHEDULED' && (
                        <button
                          className="btn btn-success btn-sm"
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => handleStatusChange(session.id, 'IN_PROGRESS')}
                        >
                          Start
                        </button>
                      )}
                      {isStaff && session.status === 'IN_PROGRESS' && (
                        <button
                          className="btn btn-secondary btn-sm"
                          style={{ marginLeft: '0.5rem' }}
                          onClick={() => handleStatusChange(session.id, 'COMPLETED')}
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

      {/* Create Session Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Create Session</h2>
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Class</label>
                <select name="classId" className="form-control" value={form.classId} onChange={handleChange} required>
                  <option value="">Select a class...</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name} ({cls.discipline})
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Date</label>
                <input type="date" name="sessionDate" className="form-control" value={form.sessionDate} onChange={handleChange} required />
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
                <button type="submit" className="btn btn-primary">Create Session</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance Detail Modal */}
      {showDetailModal && attendance && (
        <div className="modal-overlay" onClick={() => setShowDetailModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>Attendance — {attendance.class.name}</h2>
            <p style={{ color: 'var(--color-text-light)', marginBottom: '1rem' }}>
              {attendance.class.discipline} · {formatDate(attendance.session.date)} · {attendance.session.startTime}-{attendance.session.endTime}
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
