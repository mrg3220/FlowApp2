import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { programApi, userApi } from '../api/client';

const DAYS = [
  { value: 'MON', label: 'Monday' },
  { value: 'TUE', label: 'Tuesday' },
  { value: 'WED', label: 'Wednesday' },
  { value: 'THU', label: 'Thursday' },
  { value: 'FRI', label: 'Friday' },
  { value: 'SAT', label: 'Saturday' },
  { value: 'SUN', label: 'Sunday' },
];

// Convert 24h "HH:mm" to 12h "h:mm AM/PM"
const formatTime12h = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export default function ProgramsPage() {
  const { isStaff, isOwner } = useAuth();
  const [programs, setPrograms] = useState([]);
  const [curricula, setCurricula] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [editingProgram, setEditingProgram] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    programId: '',
    skillLevel: 'ALL_LEVELS',
    capacity: 20,
    description: '',
    instructorId: '',
  });
  const [scheduleForm, setScheduleForm] = useState({
    dayOfWeek: 'MON',
    startTime: '09:00',
    endTime: '10:00',
    effectiveFrom: new Date().toISOString().split('T')[0],
    effectiveUntil: '',
  });
  const [editingSchedule, setEditingSchedule] = useState(null);

  useEffect(() => {
    fetchPrograms();
    fetchCurricula();
    if (isStaff) {
      userApi.getAll({ role: 'INSTRUCTOR' }).then(setInstructors).catch(() => {});
    }
  }, [isStaff]);

  const fetchPrograms = async () => {
    try {
      const data = await programApi.getAll();
      setPrograms(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchCurricula = async () => {
    try {
      const data = await programApi.getCurricula();
      setCurricula(data);
    } catch (err) {
      console.error('Failed to fetch curricula:', err);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value, 10) : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const openCreate = () => {
    setEditingProgram(null);
    setForm({ name: '', programId: '', skillLevel: 'ALL_LEVELS', capacity: 20, description: '', instructorId: '' });
    setShowModal(true);
  };

  const openEdit = (prog) => {
    setEditingProgram(prog);
    setForm({
      name: prog.name,
      programId: prog.programId || '',
      skillLevel: prog.skillLevel,
      capacity: prog.capacity,
      description: prog.description || '',
      instructorId: prog.instructorId,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingProgram) {
        await programApi.update(editingProgram.id, form);
      } else {
        await programApi.create(form);
      }
      setShowModal(false);
      fetchPrograms();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this program?')) return;
    try {
      await programApi.delete(id);
      fetchPrograms();
    } catch (err) {
      setError(err.message);
    }
  };

  // Schedule management
  const openScheduleModal = (prog) => {
    setSelectedProgram(prog);
    setEditingSchedule(null);
    setScheduleForm({
      dayOfWeek: 'MON',
      startTime: '09:00',
      endTime: '10:00',
      effectiveFrom: new Date().toISOString().split('T')[0],
      effectiveUntil: '',
    });
    setShowScheduleModal(true);
  };

  const editSchedule = (schedule) => {
    setEditingSchedule(schedule);
    setScheduleForm({
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      effectiveFrom: schedule.effectiveFrom ? schedule.effectiveFrom.split('T')[0] : '',
      effectiveUntil: schedule.effectiveUntil ? schedule.effectiveUntil.split('T')[0] : '',
    });
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingSchedule) {
        await programApi.updateSchedule(selectedProgram.id, editingSchedule.id, scheduleForm);
      } else {
        await programApi.addSchedule(selectedProgram.id, scheduleForm);
      }
      // Refresh program data
      const updatedProgram = await programApi.getById(selectedProgram.id);
      setSelectedProgram(updatedProgram);
      setEditingSchedule(null);
      setScheduleForm({
        dayOfWeek: 'MON',
        startTime: '09:00',
        endTime: '10:00',
        effectiveFrom: new Date().toISOString().split('T')[0],
        effectiveUntil: '',
      });
      fetchPrograms();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Delete this recurring schedule?')) return;
    try {
      await programApi.deleteSchedule(selectedProgram.id, scheduleId);
      const updatedProgram = await programApi.getById(selectedProgram.id);
      setSelectedProgram(updatedProgram);
      fetchPrograms();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading programs...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Programs</h1>
        {isStaff && (
          <button className="btn btn-primary" onClick={openCreate}>
            + New Program
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {programs.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>
            No programs yet. {isStaff ? 'Create your first program!' : 'Check back later.'}
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Curriculum</th>
                  <th>Level</th>
                  <th>Capacity</th>
                  <th>Instructor</th>
                  <th>Schedule</th>
                  {isStaff && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {programs.map((prog) => (
                  <tr key={prog.id}>
                    <td><strong>{prog.name}</strong></td>
                    <td>{prog.program?.name || prog.discipline || '—'}</td>
                    <td>{prog.skillLevel.replace('_', ' ')}</td>
                    <td>{prog.capacity}</td>
                    <td>{prog.instructor?.firstName} {prog.instructor?.lastName}</td>
                    <td>
                      {prog.schedules?.length > 0 ? (
                        prog.schedules.map((s) => (
                          <div key={s.id} style={{ fontSize: '0.85rem' }}>
                            {DAYS.find((d) => d.value === s.dayOfWeek)?.label?.slice(0, 3)} {s.startTime}-{s.endTime}
                          </div>
                        ))
                      ) : (
                        <span style={{ color: '#888', fontSize: '0.85rem' }}>No schedule</span>
                      )}
                      {isStaff && (
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ marginTop: '0.25rem', fontSize: '0.75rem' }}
                          onClick={() => openScheduleModal(prog)}
                        >
                          {prog.schedules?.length > 0 ? 'Edit' : '+ Add'}
                        </button>
                      )}
                    </td>
                    {isStaff && (
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(prog)}>
                          Edit
                        </button>
                        {isOwner && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: '0.5rem' }}
                            onClick={() => handleDelete(prog.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="modal">
            <h2>{editingProgram ? 'Edit Program' : 'New Program'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Program Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Evening Wing Chun"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Curriculum</label>
                  <select
                    name="programId"
                    className="form-control"
                    value={form.programId}
                    onChange={handleChange}
                  >
                    <option value="">No curriculum linked</option>
                    {curricula.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Skill Level</label>
                  <select name="skillLevel" className="form-control" value={form.skillLevel} onChange={handleChange}>
                    <option value="ALL_LEVELS">All Levels</option>
                    <option value="BEGINNER">Beginner</option>
                    <option value="INTERMEDIATE">Intermediate</option>
                    <option value="ADVANCED">Advanced</option>
                  </select>
                </div>
                <div className="form-group">
                  <label>Capacity</label>
                  <input
                    type="number"
                    name="capacity"
                    className="form-control"
                    value={form.capacity}
                    onChange={handleChange}
                    min={1}
                    required
                  />
                </div>
              </div>
              {isOwner && instructors.length > 0 && (
                <div className="form-group">
                  <label>Instructor</label>
                  <select name="instructorId" className="form-control" value={form.instructorId} onChange={handleChange}>
                    <option value="">Select instructor...</option>
                    {instructors.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.firstName} {i.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <div className="form-group">
                <label>Description</label>
                <textarea
                  name="description"
                  className="form-control"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  placeholder="Brief description of the program"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingProgram ? 'Update' : 'Create'} Program
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedProgram && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowScheduleModal(false); }}>
          <div className="modal" style={{ maxWidth: '600px' }}>
            <h2>📅 Program Schedule — {selectedProgram.name}</h2>
            <p style={{ color: '#666', marginBottom: '1rem' }}>
              Set recurring weekly schedule. Classes repeat on the same day(s) each week.
            </p>

            {/* Existing schedules */}
            {selectedProgram.schedules?.length > 0 && (
              <div style={{ marginBottom: '1.5rem' }}>
                <h4 style={{ marginBottom: '0.5rem' }}>Current Schedule</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedProgram.schedules.map((s) => (
                    <div
                      key={s.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.75rem',
                        background: editingSchedule?.id === s.id ? '#e3f2fd' : '#f5f5f5',
                        borderRadius: '8px',
                      }}
                    >
                      <span>
                        <strong>{DAYS.find((d) => d.value === s.dayOfWeek)?.label}</strong>
                        {' '}{formatTime12h(s.startTime)} - {formatTime12h(s.endTime)}
                        {s.effectiveFrom && <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '0.5rem' }}>from {new Date(s.effectiveFrom).toLocaleDateString()}</span>}
                        {s.effectiveUntil && <span style={{ color: '#666', fontSize: '0.85rem' }}> until {new Date(s.effectiveUntil).toLocaleDateString()}</span>}
                      </span>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn btn-sm btn-outline" onClick={() => editSchedule(s)}>
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ color: '#dc3545' }}
                          onClick={() => handleDeleteSchedule(s.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add/Edit schedule form */}
            <form onSubmit={handleSaveSchedule}>
              <h4 style={{ marginBottom: '0.5rem' }}>{editingSchedule ? 'Edit Schedule' : 'Add Recurring Schedule'}</h4>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label>Day of Week</label>
                  <select
                    className="form-control"
                    value={scheduleForm.dayOfWeek}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, dayOfWeek: e.target.value })}
                  >
                    {DAYS.map((d) => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Start Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={scheduleForm.startTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, startTime: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Time</label>
                  <input
                    type="time"
                    className="form-control"
                    value={scheduleForm.endTime}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, endTime: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                <div className="form-group">
                  <label>Start Date</label>
                  <input
                    type="date"
                    className="form-control"
                    value={scheduleForm.effectiveFrom}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, effectiveFrom: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>End Date (optional)</label>
                  <input
                    type="date"
                    className="form-control"
                    value={scheduleForm.effectiveUntil}
                    onChange={(e) => setScheduleForm({ ...scheduleForm, effectiveUntil: e.target.value })}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                <button type="submit" className="btn btn-primary">
                  {editingSchedule ? 'Update' : 'Add'} Schedule
                </button>
                {editingSchedule && (
                  <button
                    type="button"
                    className="btn btn-outline"
                    onClick={() => {
                      setEditingSchedule(null);
                      setScheduleForm({
                        dayOfWeek: 'MON',
                        startTime: '09:00',
                        endTime: '10:00',
                        effectiveFrom: new Date().toISOString().split('T')[0],
                        effectiveUntil: '',
                      });
                    }}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>

            <div style={{ marginTop: '1.5rem', borderTop: '1px solid #eee', paddingTop: '1rem' }}>
              <button className="btn btn-outline" onClick={() => setShowScheduleModal(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
