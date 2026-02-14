import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { metricsApi, schoolApi } from '../api/client';

export default function MetricsPage() {
  const { user, isSuperAdmin, isOwner, isInstructor, isStudent } = useAuth();

  if (isSuperAdmin) return <SuperAdminMetrics />;
  if (isOwner || isInstructor) return <SchoolMetrics />;
  if (isStudent) return <StudentMetrics />;

  return <div className="loading">Access denied</div>;
}

// ─── Super Admin Dashboard ──────────────────────────────

function SuperAdminMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    metricsApi.getSuperAdmin()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading metrics...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Network Overview</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{data.overview.totalSchools}</div>
          <div className="stat-label">Schools</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.totalStudents}</div>
          <div className="stat-label">Active Students</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.totalClasses}</div>
          <div className="stat-label">Active Classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.totalCheckIns7d}</div>
          <div className="stat-label">Check-ins (7d)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.totalCheckIns30d}</div>
          <div className="stat-label">Check-ins (30d)</div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2>School Performance</h2>
        </div>
        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>School</th>
                <th>Owner</th>
                <th>Classes</th>
                <th>Students</th>
                <th>Check-ins (7d)</th>
                <th>Check-ins (30d)</th>
              </tr>
            </thead>
            <tbody>
              {data.schools.map((school) => (
                <tr key={school.id}>
                  <td><strong>{school.name}</strong></td>
                  <td>{school.owner}</td>
                  <td>{school.activeClasses}</td>
                  <td>{school.activeStudents}</td>
                  <td>{school.checkIns7d}</td>
                  <td>{school.checkIns30d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── School-Level Dashboard (Owner/Instructor) ─────────

function SchoolMetrics() {
  const { user, isOwner } = useAuth();
  const [schools, setSchools] = useState([]);
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const init = async () => {
      try {
        const schoolList = await schoolApi.getAll();
        setSchools(schoolList);
        if (schoolList.length > 0) {
          const defaultId = user.schoolId || schoolList[0].id;
          setSelectedSchoolId(defaultId);
          const metrics = await metricsApi.getSchool(defaultId);
          setData(metrics);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  const handleSchoolChange = async (schoolId) => {
    setSelectedSchoolId(schoolId);
    setLoading(true);
    try {
      const metrics = await metricsApi.getSchool(schoolId);
      setData(metrics);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !data) return <div className="loading">Loading metrics...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>School Metrics</h1>
        {schools.length > 1 && (
          <select
            className="form-control"
            style={{ width: 'auto' }}
            value={selectedSchoolId}
            onChange={(e) => handleSchoolChange(e.target.value)}
          >
            {schools.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {data && (
        <>
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{data.overview.activeStudents}</div>
              <div className="stat-label">Active Students</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.overview.activeClasses}</div>
              <div className="stat-label">Active Classes</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.overview.totalCheckIns30d}</div>
              <div className="stat-label">Check-ins (30d)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{data.overview.newEnrollments30d}</div>
              <div className="stat-label">New Enrollments (30d)</div>
            </div>
          </div>

          {/* Class Performance */}
          <div className="card">
            <div className="card-header">
              <h2>Class Performance (Last 30 Days)</h2>
            </div>
            {data.classes.length === 0 ? (
              <p style={{ color: 'var(--color-text-light)' }}>No classes yet.</p>
            ) : (
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr>
                      <th>Class</th>
                      <th>Discipline</th>
                      <th>Instructor</th>
                      <th>Sessions</th>
                      <th>Total Attendance</th>
                      <th>Avg Attendance</th>
                      <th>Utilization</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.classes.map((cls) => (
                      <tr key={cls.id}>
                        <td><strong>{cls.name}</strong></td>
                        <td>{cls.discipline}</td>
                        <td>{cls.instructor}</td>
                        <td>{cls.sessionsLast30d}</td>
                        <td>{cls.totalAttendanceLast30d}</td>
                        <td>{cls.avgAttendance}</td>
                        <td>
                          <div className="utilization-bar">
                            <div
                              className="utilization-fill"
                              style={{
                                width: `${Math.min(cls.utilizationRate, 100)}%`,
                                background: cls.utilizationRate > 80
                                  ? 'var(--color-success)'
                                  : cls.utilizationRate > 50
                                  ? 'var(--color-warning)'
                                  : 'var(--color-danger)',
                              }}
                            />
                            <span>{cls.utilizationRate}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Top Students */}
          {data.topStudents?.length > 0 && (
            <div className="card">
              <div className="card-header">
                <h2>Top Students (Last 30 Days)</h2>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>#</th><th>Student</th><th>Email</th><th>Check-ins</th></tr>
                  </thead>
                  <tbody>
                    {data.topStudents.map((s, i) => (
                      <tr key={i}>
                        <td>{i + 1}</td>
                        <td><strong>{s.firstName} {s.lastName}</strong></td>
                        <td>{s.email}</td>
                        <td>{s.checkIns}</td>
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

// ─── Student's Personal Dashboard ───────────────────────

function StudentMetrics() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    metricsApi.getStudent()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading">Loading your stats...</div>;
  if (error) return <div className="alert alert-error">{error}</div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Stats</h1>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{data.overview.totalCheckIns}</div>
          <div className="stat-label">Total Classes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.last30Days}</div>
          <div className="stat-label">Last 30 Days</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.weeklyAvg}</div>
          <div className="stat-label">Weekly Avg</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{data.overview.currentSchool}</div>
          <div className="stat-label">Current School</div>
        </div>
      </div>

      {/* Disciplines */}
      {data.disciplines?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Disciplines</h2>
          </div>
          <div className="discipline-grid">
            {data.disciplines.map((d, i) => (
              <div key={i} className="discipline-card">
                <div className="discipline-name">{d.discipline}</div>
                <div className="discipline-stat">{d.count} classes</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly Trend */}
      {data.weeklyTrend?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Weekly Activity (Last 12 Weeks)</h2>
          </div>
          <div className="bar-chart">
            {data.weeklyTrend.map((w, i) => (
              <div key={i} className="bar-col">
                <div
                  className="bar"
                  style={{
                    height: `${Math.max((w.checkIns / Math.max(...data.weeklyTrend.map((t) => t.checkIns), 1)) * 100, 4)}%`,
                  }}
                >
                  {w.checkIns > 0 && <span>{w.checkIns}</span>}
                </div>
                <div className="bar-label">W{i + 1}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Classes */}
      {data.recentClasses?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <h2>Recent Classes</h2>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>Date</th><th>Class</th><th>Discipline</th><th>School</th></tr>
              </thead>
              <tbody>
                {data.recentClasses.map((c, i) => (
                  <tr key={i}>
                    <td>{new Date(c.date).toLocaleDateString()}</td>
                    <td><strong>{c.className}</strong></td>
                    <td>{c.discipline}</td>
                    <td>{c.school}</td>
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
