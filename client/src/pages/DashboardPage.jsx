import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { sessionApi, classApi, schoolApi, metricsApi } from '../api/client';
import { displayRole } from '../utils/displayRole';

export default function DashboardPage() {
  const { user, isSuperAdmin, isOwner, isStaff, isStudent } = useAuth();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [classes, setClasses] = useState([]);
  const [schools, setSchools] = useState([]);
  const [studentStats, setStudentStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const promises = [
          sessionApi.getAll({ from: today, to: today }),
          classApi.getAll(),
        ];

        if (isSuperAdmin || isOwner) {
          promises.push(schoolApi.getAll());
        }

        if (isStudent) {
          promises.push(metricsApi.getStudent().catch(() => null));
        }

        const results = await Promise.all(promises);
        setSessions(results[0]);
        setClasses(results[1]);

        if (isSuperAdmin || isOwner) {
          setSchools(results[2] || []);
        }
        if (isStudent && results[2]) {
          setStudentStats(results[2]);
        } else if (isStudent && results[3]) {
          setStudentStats(results[3]);
        }
      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const totalStudentsToday = sessions.reduce((sum, s) => sum + (s._count?.checkIns || 0), 0);

  return (
    <div>
      <div className="page-header">
        <h1>Welcome, {user?.firstName}!</h1>
        <span className={`badge badge-${user?.role?.toLowerCase().replace('_', '-')}`}>
          {displayRole(user?.role)}
        </span>
      </div>

      {/* ─── Super Admin Overview ───────────────────────── */}
      {isSuperAdmin && schools.length > 0 && (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => navigate('/schools')} style={{ cursor: 'pointer' }}>
              <div className="stat-value">{schools.length}</div>
              <div className="stat-label">Schools</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">
                {schools.reduce((sum, s) => sum + (s._count?.enrollments || 0), 0)}
              </div>
              <div className="stat-label">Total Students</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{classes.length}</div>
              <div className="stat-label">Active Classes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalStudentsToday}</div>
              <div className="stat-label">Check-ins Today</div>
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h2>Schools Overview</h2>
              <button className="btn btn-outline btn-sm" onClick={() => navigate('/metrics')}>
                View Detailed Metrics →
              </button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>School</th><th>Owner</th><th>Classes</th><th>Students</th></tr>
                </thead>
                <tbody>
                  {schools.map((s) => (
                    <tr key={s.id}>
                      <td><strong>{s.name}</strong></td>
                      <td>{s.owner?.firstName} {s.owner?.lastName}</td>
                      <td>{s._count?.classes || 0}</td>
                      <td>{s._count?.enrollments || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ─── Owner/Instructor Overview ──────────────────── */}
      {(isOwner || (isStaff && !isSuperAdmin)) && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{sessions.length}</div>
              <div className="stat-label">Sessions Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{totalStudentsToday}</div>
              <div className="stat-label">Check-ins Today</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{classes.length}</div>
              <div className="stat-label">Active Classes</div>
            </div>
            {isOwner && schools.length > 0 && (
              <div className="stat-card" onClick={() => navigate('/schools')} style={{ cursor: 'pointer' }}>
                <div className="stat-value">{schools.length}</div>
                <div className="stat-label">My Schools</div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ─── Student Overview ──────────────────────────── */}
      {isStudent && (
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{studentStats?.overview?.totalCheckIns || 0}</div>
            <div className="stat-label">Total Classes</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{studentStats?.overview?.last30Days || 0}</div>
            <div className="stat-label">Last 30 Days</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{studentStats?.overview?.weeklyAvg || 0}</div>
            <div className="stat-label">Weekly Avg</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{studentStats?.overview?.currentSchool || 'None'}</div>
            <div className="stat-label">Current School</div>
          </div>
        </div>
      )}

      {/* ─── Today's Sessions ──────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2>Today's Sessions</h2>
        </div>
        {sessions.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>No sessions scheduled for today.</p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Discipline</th>
                  <th>Time</th>
                  <th>Instructor</th>
                  <th>Attendance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id}>
                    <td><strong>{session.class.name}</strong></td>
                    <td>{session.class.discipline}</td>
                    <td>{session.startTime} - {session.endTime}</td>
                    <td>{session.class.instructor?.firstName} {session.class.instructor?.lastName}</td>
                    <td>
                      {session._count?.checkIns || 0} / {session.class.capacity}
                    </td>
                    <td>
                      <span className={`badge badge-${session.status.toLowerCase().replace('_', '-')}`}>
                        {session.status.replace('_', ' ')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Active Classes (Staff only) ──────────────── */}
      {isStaff && classes.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Active Classes</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Discipline</th>
                  <th>Level</th>
                  <th>Capacity</th>
                  <th>Instructor</th>
                  {(isSuperAdmin || isOwner) && <th>School</th>}
                </tr>
              </thead>
              <tbody>
                {classes.map((cls) => (
                  <tr key={cls.id}>
                    <td><strong>{cls.name}</strong></td>
                    <td>{cls.discipline}</td>
                    <td>{cls.skillLevel.replace('_', ' ')}</td>
                    <td>{cls.capacity}</td>
                    <td>{cls.instructor?.firstName} {cls.instructor?.lastName}</td>
                    {(isSuperAdmin || isOwner) && <td>{cls.school?.name || '—'}</td>}
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
