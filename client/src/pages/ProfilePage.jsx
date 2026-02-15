import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { profileApi } from '../api/client';
import { displayRole } from '../utils/displayRole';

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [form, setForm] = useState({
    firstName: '', lastName: '', phone: '', bio: '', beltRank: '',
    currentPassword: '', newPassword: '', confirmPassword: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const data = await profileApi.get();
      setProfile(data);
      setForm({
        firstName: data.firstName || '',
        lastName: data.lastName || '',
        phone: data.phone || '',
        bio: data.bio || '',
        beltRank: data.beltRank || '',
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (form.newPassword && form.newPassword !== form.confirmPassword) {
      setMessage({ type: 'error', text: 'New passwords do not match' });
      return;
    }

    try {
      const updateData = {
        firstName: form.firstName,
        lastName: form.lastName,
        phone: form.phone,
        bio: form.bio,
        beltRank: form.beltRank,
      };
      if (form.newPassword) {
        updateData.currentPassword = form.currentPassword;
        updateData.newPassword = form.newPassword;
      }

      await profileApi.update(updateData);
      setMessage({ type: 'success', text: 'Profile updated successfully' });
      setEditing(false);
      fetchProfile();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) return <div className="loading">Loading profile...</div>;
  if (!profile) return <div className="alert alert-error">Failed to load profile</div>;

  return (
    <div>
      <div className="page-header">
        <h1>My Profile</h1>
        {!editing && (
          <button className="btn btn-primary" onClick={() => setEditing(true)}>
            Edit Profile
          </button>
        )}
      </div>

      {message.text && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      {!editing ? (
        <>
          {/* Profile Overview */}
          <div className="card">
            <div style={{ display: 'flex', gap: '2rem', alignItems: 'flex-start' }}>
              <div className="profile-avatar">
                {profile.firstName?.[0]}{profile.lastName?.[0]}
              </div>
              <div style={{ flex: 1 }}>
                <h2>{profile.firstName} {profile.lastName}</h2>
                <p style={{ color: 'var(--color-text-light)', marginBottom: '0.5rem' }}>
                  <span className={`badge badge-${profile.role.toLowerCase()}`}>{displayRole(profile.role)}</span>
                  {profile.beltRank && <span className="badge badge-scheduled" style={{ marginLeft: '0.5rem' }}>{profile.beltRank}</span>}
                </p>
                <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)' }}>{profile.email}</p>
                {profile.phone && <p style={{ fontSize: '0.9rem', color: 'var(--color-text-light)' }}>{profile.phone}</p>}
                {profile.bio && <p style={{ marginTop: '0.75rem' }}>{profile.bio}</p>}
                {profile.school && (
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem' }}>
                    <strong>School:</strong> {profile.school.name}
                  </p>
                )}
                <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginTop: '0.5rem' }}>
                  Member since {new Date(profile.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

          {/* Enrollment History */}
          {profile.enrollments?.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Enrollment History</h3>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>School</th><th>Status</th><th>Enrolled</th></tr>
                  </thead>
                  <tbody>
                    {profile.enrollments.map((e) => (
                      <tr key={e.id}>
                        <td>{e.school.name}</td>
                        <td><span className={`badge badge-${e.status === 'ACTIVE' ? 'completed' : 'cancelled'}`}>{e.status}</span></td>
                        <td>{new Date(e.enrolledAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Disciplines */}
          {profile.disciplines?.length > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Disciplines</h3>
              <div className="discipline-grid">
                {profile.disciplines.map((d, i) => (
                  <div key={i} className="discipline-card">
                    <div className="discipline-name">{d.discipline}</div>
                    {d.totalClasses && <div className="discipline-stat">{d.totalClasses} classes attended</div>}
                    {d.className && <div className="discipline-stat">{d.className}</div>}
                    {d.sessionCount !== undefined && <div className="discipline-stat">{d.sessionCount} sessions taught</div>}
                    {d.lastAttended && (
                      <div className="discipline-stat">Last: {new Date(d.lastAttended).toLocaleDateString()}</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Stats */}
          {profile.attendanceStats?.totalCheckIns > 0 && (
            <div className="card">
              <h3 style={{ marginBottom: '0.75rem' }}>Attendance</h3>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{profile.attendanceStats.totalCheckIns}</div>
                  <div className="stat-label">Total Check-ins</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{profile.attendanceStats.last30Days}</div>
                  <div className="stat-label">Last 30 Days</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{profile.attendanceStats.weeklyAvg}</div>
                  <div className="stat-label">Weekly Avg</div>
                </div>
              </div>
            </div>
          )}
        </>
      ) : (
        /* Edit Form */
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input type="text" name="firstName" className="form-control" value={form.firstName} onChange={handleChange} required />
              </div>
              <div className="form-group">
                <label>Last Name</label>
                <input type="text" name="lastName" className="form-control" value={form.lastName} onChange={handleChange} required />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Phone</label>
                <input type="tel" name="phone" className="form-control" value={form.phone} onChange={handleChange} />
              </div>
              <div className="form-group">
                <label>Belt Rank</label>
                <input type="text" name="beltRank" className="form-control" value={form.beltRank} onChange={handleChange} placeholder="e.g. Blue Belt, 2nd Dan" />
              </div>
            </div>
            <div className="form-group">
              <label>Bio</label>
              <textarea name="bio" className="form-control" value={form.bio} onChange={handleChange} rows={3} placeholder="Tell us about yourself and your martial arts journey..." />
            </div>

            <hr style={{ margin: '1.5rem 0', borderColor: 'var(--color-border)' }} />
            <h3 style={{ marginBottom: '1rem' }}>Change Password (optional)</h3>

            <div className="form-group">
              <label>Current Password</label>
              <input type="password" name="currentPassword" className="form-control" value={form.currentPassword} onChange={handleChange} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>New Password</label>
                <input type="password" name="newPassword" className="form-control" value={form.newPassword} onChange={handleChange} minLength={6} />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input type="password" name="confirmPassword" className="form-control" value={form.confirmPassword} onChange={handleChange} />
              </div>
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-outline" onClick={() => { setEditing(false); setMessage({ type: '', text: '' }); }}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary">Save Changes</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
