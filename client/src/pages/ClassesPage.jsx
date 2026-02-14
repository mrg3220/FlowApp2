import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { classApi, userApi } from '../api/client';

export default function ClassesPage() {
  const { isStaff, isOwner } = useAuth();
  const [classes, setClasses] = useState([]);
  const [instructors, setInstructors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    name: '',
    discipline: '',
    skillLevel: 'ALL_LEVELS',
    capacity: 20,
    description: '',
    instructorId: '',
  });

  useEffect(() => {
    fetchClasses();
    if (isStaff) {
      userApi.getAll({ role: 'INSTRUCTOR' }).then(setInstructors).catch(() => {});
    }
  }, [isStaff]);

  const fetchClasses = async () => {
    try {
      const data = await classApi.getAll();
      setClasses(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.type === 'number' ? parseInt(e.target.value, 10) : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const openCreate = () => {
    setEditingClass(null);
    setForm({ name: '', discipline: '', skillLevel: 'ALL_LEVELS', capacity: 20, description: '', instructorId: '' });
    setShowModal(true);
  };

  const openEdit = (cls) => {
    setEditingClass(cls);
    setForm({
      name: cls.name,
      discipline: cls.discipline,
      skillLevel: cls.skillLevel,
      capacity: cls.capacity,
      description: cls.description || '',
      instructorId: cls.instructorId,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editingClass) {
        await classApi.update(editingClass.id, form);
      } else {
        await classApi.create(form);
      }
      setShowModal(false);
      fetchClasses();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to deactivate this class?')) return;
    try {
      await classApi.delete(id);
      fetchClasses();
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="loading">Loading classes...</div>;

  return (
    <div>
      <div className="page-header">
        <h1>Classes</h1>
        {isStaff && (
          <button className="btn btn-primary" onClick={openCreate}>
            + New Class
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {classes.length === 0 ? (
          <p style={{ color: 'var(--color-text-light)' }}>
            No classes yet. {isStaff ? 'Create your first class!' : 'Check back later.'}
          </p>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Discipline</th>
                  <th>Level</th>
                  <th>Capacity</th>
                  <th>Instructor</th>
                  <th>Schedule</th>
                  {isStaff && <th>Actions</th>}
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
                    <td>
                      {cls.schedules?.map((s) => (
                        <div key={s.id} style={{ fontSize: '0.85rem' }}>
                          {s.dayOfWeek} {s.startTime}-{s.endTime}
                        </div>
                      ))}
                    </td>
                    {isStaff && (
                      <td>
                        <button className="btn btn-outline btn-sm" onClick={() => openEdit(cls)}>
                          Edit
                        </button>
                        {isOwner && (
                          <button
                            className="btn btn-danger btn-sm"
                            style={{ marginLeft: '0.5rem' }}
                            onClick={() => handleDelete(cls.id)}
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
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>{editingClass ? 'Edit Class' : 'New Class'}</h2>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Class Name</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    value={form.name}
                    onChange={handleChange}
                    placeholder="e.g. Evening Karate"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Discipline</label>
                  <input
                    type="text"
                    name="discipline"
                    className="form-control"
                    value={form.discipline}
                    onChange={handleChange}
                    placeholder="e.g. Karate, BJJ, Kickboxing"
                    required
                  />
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
                  placeholder="Brief description of the class"
                />
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  {editingClass ? 'Update' : 'Create'} Class
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
