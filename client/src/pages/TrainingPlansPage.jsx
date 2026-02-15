import { useState, useEffect } from 'react';
import { trainingPlanApi, schoolApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

export default function TrainingPlansPage() {
  const { user } = useAuth();
  const isStudent = user?.role === 'STUDENT';
  const isStaff = !isStudent;
  const [schools, setSchools] = useState([]);
  const [schoolId, setSchoolId] = useState('');
  const [tab, setTab] = useState(isStudent ? 'MY' : 'PLANS');
  const [plans, setPlans] = useState([]);
  const [myPlans, setMyPlans] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', difficulty: '', durationWeeks: '' });
  const [exercises, setExercises] = useState([{ name: '', sets: '', reps: '', duration: '', notes: '', sortOrder: 0 }]);
  const [assignForm, setAssignForm] = useState({ userId: '', classId: '' });
  const [showAssign, setShowAssign] = useState(false);

  useEffect(() => {
    schoolApi.getAll().then((s) => { setSchools(s); if (s.length) setSchoolId(s[0].id); });
  }, []);

  useEffect(() => {
    if (!schoolId) return;
    if (isStaff) trainingPlanApi.getBySchool(schoolId).then(setPlans);
    trainingPlanApi.getMyPlans().then(setMyPlans);
  }, [schoolId]);

  const loadPlan = async (id) => {
    const plan = await trainingPlanApi.getById(id);
    setSelected(plan);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const data = {
      ...form,
      durationWeeks: form.durationWeeks ? Number(form.durationWeeks) : null,
      exercises: exercises.filter((ex) => ex.name.trim()).map((ex, i) => ({
        name: ex.name, sets: ex.sets ? Number(ex.sets) : null, reps: ex.reps ? Number(ex.reps) : null,
        duration: ex.duration || null, notes: ex.notes || null, sortOrder: i,
      })),
    };
    await trainingPlanApi.create(schoolId, data);
    setShowForm(false);
    setForm({ name: '', description: '', difficulty: '', durationWeeks: '' });
    setExercises([{ name: '', sets: '', reps: '', duration: '', notes: '', sortOrder: 0 }]);
    trainingPlanApi.getBySchool(schoolId).then(setPlans);
  };

  const addExerciseRow = () => setExercises((prev) => [...prev, { name: '', sets: '', reps: '', duration: '', notes: '', sortOrder: prev.length }]);
  const removeExerciseRow = (i) => setExercises((prev) => prev.filter((_, idx) => idx !== i));

  const handleAssign = async (e) => {
    e.preventDefault();
    const data = {};
    if (assignForm.userId) data.userId = assignForm.userId;
    if (assignForm.classId) data.classId = assignForm.classId;
    await trainingPlanApi.assignPlan(selected.id, data);
    setShowAssign(false);
    setAssignForm({ userId: '', classId: '' });
    loadPlan(selected.id);
  };

  const handleDeletePlan = async (id) => {
    if (!confirm('Delete this plan?')) return;
    await trainingPlanApi.delete(id);
    if (selected?.id === id) setSelected(null);
    trainingPlanApi.getBySchool(schoolId).then(setPlans);
  };

  return (
    <div className="page">
      <h1>🏋️ Training Plans</h1>

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {isStaff && (
          <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="form-input" style={{ width: 'auto' }}>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {isStaff && <button className={`btn ${tab === 'PLANS' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('PLANS')}>All Plans</button>}
        <button className={`btn ${tab === 'MY' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('MY')}>My Plans</button>
        {isStaff && <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>+ New Plan</button>}
      </div>

      {showForm && isStaff && (
        <form onSubmit={handleSave} className="card" style={{ padding: '1rem', marginBottom: '1rem' }}>
          <h3>New Training Plan</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.5rem' }}>
            <input className="form-input" placeholder="Plan Name *" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="form-input" placeholder="Difficulty (e.g. Beginner)" value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} />
            <input className="form-input" type="number" placeholder="Duration (weeks)" value={form.durationWeeks} onChange={(e) => setForm({ ...form, durationWeeks: e.target.value })} />
          </div>
          <textarea className="form-input" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ marginTop: '0.5rem' }} />

          <h4 style={{ marginTop: '1rem' }}>Exercises</h4>
          {exercises.map((ex, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 2fr auto', gap: '0.3rem', marginBottom: '0.3rem' }}>
              <input className="form-input" placeholder="Exercise name" value={ex.name} onChange={(e) => { const n = [...exercises]; n[i].name = e.target.value; setExercises(n); }} />
              <input className="form-input" type="number" placeholder="Sets" value={ex.sets} onChange={(e) => { const n = [...exercises]; n[i].sets = e.target.value; setExercises(n); }} />
              <input className="form-input" type="number" placeholder="Reps" value={ex.reps} onChange={(e) => { const n = [...exercises]; n[i].reps = e.target.value; setExercises(n); }} />
              <input className="form-input" placeholder="Duration" value={ex.duration} onChange={(e) => { const n = [...exercises]; n[i].duration = e.target.value; setExercises(n); }} />
              <input className="form-input" placeholder="Notes" value={ex.notes} onChange={(e) => { const n = [...exercises]; n[i].notes = e.target.value; setExercises(n); }} />
              <button type="button" className="btn btn-sm btn-outline" style={{ color: '#ef4444' }} onClick={() => removeExerciseRow(i)}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-sm btn-outline" onClick={addExerciseRow}>+ Add Exercise</button>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" className="btn btn-primary">Create Plan</button>
            <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </form>
      )}

      <div style={{ display: 'flex', gap: '1rem' }}>
        <div style={{ flex: 2 }}>
          {tab === 'PLANS' && isStaff && (
            <table className="data-table">
              <thead><tr><th>Plan</th><th>Difficulty</th><th>Duration</th><th>Exercises</th><th>Assigned</th><th>Actions</th></tr></thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.id} onClick={() => loadPlan(p.id)} style={{ cursor: 'pointer', background: selected?.id === p.id ? '#eef6ff' : undefined }}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.difficulty || '—'}</td>
                    <td>{p.durationWeeks ? `${p.durationWeeks} wks` : '—'}</td>
                    <td>{p.exercises?.length || 0}</td>
                    <td>{p._count?.assignments || 0}</td>
                    <td>
                      <button className="btn btn-sm btn-outline" onClick={(e) => { e.stopPropagation(); handleDeletePlan(p.id); }} style={{ color: '#ef4444' }}>Delete</button>
                    </td>
                  </tr>
                ))}
                {plans.length === 0 && <tr><td colSpan={6} style={{ textAlign: 'center', color: '#888' }}>No plans</td></tr>}
              </tbody>
            </table>
          )}

          {tab === 'MY' && (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {myPlans.map((a) => (
                <div key={a.id} className="card" style={{ padding: '1rem', cursor: 'pointer' }} onClick={() => a.plan && setSelected(a.plan)}>
                  <h3 style={{ margin: '0 0 0.25rem' }}>{a.plan?.name}</h3>
                  {a.plan?.difficulty && <span style={{ fontSize: '0.8rem', background: '#e0e7ff', padding: '0.1rem 0.4rem', borderRadius: '8px' }}>{a.plan.difficulty}</span>}
                  <p style={{ fontSize: '0.85rem', color: '#666', margin: '0.5rem 0 0' }}>{a.plan?.description}</p>
                  <div style={{ fontSize: '0.8rem', color: '#888' }}>Assigned: {new Date(a.assignedAt).toLocaleDateString()}</div>
                </div>
              ))}
              {myPlans.length === 0 && <p style={{ color: '#888' }}>No plans assigned to you</p>}
            </div>
          )}
        </div>

        {selected && (
          <div className="card" style={{ padding: '1rem', flex: 1, maxHeight: '80vh', overflowY: 'auto' }}>
            <h2>{selected.name}</h2>
            {selected.difficulty && <span style={{ fontSize: '0.85rem', background: '#e0e7ff', padding: '0.2rem 0.6rem', borderRadius: '10px' }}>{selected.difficulty}</span>}
            {selected.durationWeeks && <span style={{ fontSize: '0.85rem', marginLeft: '0.5rem', color: '#888' }}>{selected.durationWeeks} weeks</span>}
            {selected.description && <p>{selected.description}</p>}

            <h4 style={{ marginTop: '1rem' }}>Exercises ({selected.exercises?.length || 0})</h4>
            {selected.exercises?.sort((a, b) => a.sortOrder - b.sortOrder).map((ex, i) => (
              <div key={ex.id} style={{ padding: '0.5rem', borderBottom: '1px solid #eee' }}>
                <strong>{i + 1}. {ex.name}</strong>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {ex.sets && `${ex.sets} sets`}{ex.reps && ` × ${ex.reps} reps`}{ex.duration && ` | ${ex.duration}`}
                </div>
                {ex.notes && <div style={{ fontSize: '0.8rem', color: '#888' }}>{ex.notes}</div>}
              </div>
            ))}

            {isStaff && (
              <>
                <h4 style={{ marginTop: '1rem' }}>Assignments ({selected.assignments?.length || 0})</h4>
                {selected.assignments?.map((a) => (
                  <div key={a.id} style={{ fontSize: '0.85rem', padding: '0.3rem 0', borderBottom: '1px solid #f0f0f0' }}>
                    {a.user ? `${a.user.firstName} ${a.user.lastName}` : a.class ? `Class: ${a.class.name}` : 'Unknown'}
                    <span style={{ color: '#888', marginLeft: '0.5rem' }}>{new Date(a.assignedAt).toLocaleDateString()}</span>
                  </div>
                ))}
                <button className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem' }} onClick={() => setShowAssign(true)}>+ Assign</button>
                {showAssign && (
                  <form onSubmit={handleAssign} style={{ marginTop: '0.5rem' }}>
                    <input className="form-input" placeholder="User ID" value={assignForm.userId} onChange={(e) => setAssignForm({ ...assignForm, userId: e.target.value })} />
                    <input className="form-input" placeholder="or Class ID" value={assignForm.classId} onChange={(e) => setAssignForm({ ...assignForm, classId: e.target.value })} style={{ marginTop: '0.25rem' }} />
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                      <button type="submit" className="btn btn-primary btn-sm">Assign</button>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowAssign(false)}>Cancel</button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
