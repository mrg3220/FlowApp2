import { useState, useEffect } from 'react';
import { sessionApi, checkInApi, userApi } from '../api/client';

export default function CheckInPage() {
  const [sessions, setSessions] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedStudent, setSelectedStudent] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [recentCheckIns, setRecentCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const [sessionsData, studentsData] = await Promise.all([
          sessionApi.getAll({ from: today, to: today }),
          userApi.getAll({ role: 'STUDENT' }),
        ]);
        // Only show active sessions
        setSessions(sessionsData.filter((s) => s.status !== 'CANCELLED' && s.status !== 'COMPLETED'));
        setStudents(studentsData);
      } catch (err) {
        setMessage({ type: 'error', text: err.message });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleCheckIn = async () => {
    if (!selectedSession || !selectedStudent) {
      setMessage({ type: 'error', text: 'Please select a session and a student' });
      return;
    }

    try {
      const result = await checkInApi.checkIn(selectedSession, selectedStudent);
      setMessage({ type: 'success', text: `${result.student.firstName} ${result.student.lastName} checked in!` });
      setRecentCheckIns([result, ...recentCheckIns]);
      setSelectedStudent('');
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleRemoveCheckIn = async (checkInId, studentName) => {
    if (!window.confirm(`Remove check-in for ${studentName}?`)) return;
    try {
      await checkInApi.remove(checkInId);
      setRecentCheckIns(recentCheckIns.filter((c) => c.id !== checkInId));
      setMessage({ type: 'success', text: 'Check-in removed' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const filteredStudents = students.filter((s) => {
    const term = searchTerm.toLowerCase();
    return (
      s.firstName.toLowerCase().includes(term) ||
      s.lastName.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term)
    );
  });

  if (loading) return <div className="loading">Loading...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Check In Students</h1>
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <h2 style={{ marginBottom: '1rem' }}>Manual Check-In</h2>

        <div className="form-group">
          <label>Select Session</label>
          <select
            className="form-control"
            value={selectedSession}
            onChange={(e) => setSelectedSession(e.target.value)}
          >
            <option value="">Choose today's session...</option>
            {sessions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.class.name} — {s.startTime} ({s._count?.checkIns || 0}/{s.class.capacity})
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Search Student</label>
          <input
            type="text"
            className="form-control"
            placeholder="Search by name or email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label>Select Student</label>
          <select
            className="form-control"
            value={selectedStudent}
            onChange={(e) => setSelectedStudent(e.target.value)}
          >
            <option value="">Choose a student...</option>
            {filteredStudents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.firstName} {s.lastName} ({s.email})
              </option>
            ))}
          </select>
        </div>

        <button className="btn btn-success" onClick={handleCheckIn}>
          ✅ Check In
        </button>
      </div>

      {recentCheckIns.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Recent Check-Ins</h2>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {recentCheckIns.map((ci) => (
                  <tr key={ci.id}>
                    <td>{ci.student.firstName} {ci.student.lastName}</td>
                    <td>{ci.session?.class?.name || 'N/A'}</td>
                    <td>{new Date(ci.checkedInAt).toLocaleTimeString()}</td>
                    <td>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() =>
                          handleRemoveCheckIn(ci.id, `${ci.student.firstName} ${ci.student.lastName}`)
                        }
                      >
                        Undo
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
