import { useState, useEffect, useCallback } from 'react';
import { studentPortalApi } from '../api/client';

const TABS = {
  OVERVIEW: 'Overview',
  ATTENDANCE: 'Attendance',
  BILLING: 'Billing',
  BELT_PROGRESS: 'Belt Progress',
  SCHEDULE: 'Schedule',
};

export default function StudentPortalPage() {
  const [tab, setTab] = useState('OVERVIEW');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentPortalApi.getDashboard()
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page"><h1>🎓 My Portal</h1><p>Loading your dashboard…</p></div>;
  if (!data) return <div className="page"><h1>🎓 My Portal</h1><p>Unable to load portal data.</p></div>;

  return (
    <div className="page student-portal-page">
      <h1>🎓 My Portal</h1>

      <div className="tab-bar" style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        {Object.entries(TABS).map(([key, label]) => (
          <button key={key} className={`btn ${tab === key ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab(key)}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'OVERVIEW' && <OverviewTab data={data} />}
      {tab === 'ATTENDANCE' && <AttendanceTab data={data} />}
      {tab === 'BILLING' && <BillingTab data={data} />}
      {tab === 'BELT_PROGRESS' && <BeltProgressTab data={data} />}
      {tab === 'SCHEDULE' && <ScheduleTab />}
    </div>
  );
}

// ─── Overview ────────────────────────────────────────────

function OverviewTab({ data }) {
  const { profile, attendance, billing, beltProgress, unreadNotifications, family, enrollments } = data;

  return (
    <div>
      {/* Quick Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Check-ins" value={attendance.totalCheckIns} emoji="✅" />
        <StatCard label="Last 30 Days" value={attendance.last30Days} emoji="📅" />
        <StatCard label="Outstanding" value={`$${billing.outstandingBalance.toFixed(2)}`} emoji="💰" color={billing.outstandingBalance > 0 ? '#e53e3e' : '#38a169'} />
        <StatCard label="Active Subs" value={billing.subscriptions.length} emoji="📋" />
        <StatCard label="Programs" value={beltProgress.length} emoji="🥋" />
        <StatCard label="Unread Alerts" value={unreadNotifications.length} emoji="🔔" color={unreadNotifications.length > 0 ? '#dd6b20' : undefined} />
      </div>

      {/* Enrollments */}
      <h3>My Schools</h3>
      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
        {enrollments.map((e) => (
          <div key={e.id} className="card" style={{ padding: '0.75rem 1.25rem' }}>
            <strong>{e.school.name}</strong>
            <div style={{ color: '#888', fontSize: '0.85rem' }}>Status: {e.status}</div>
          </div>
        ))}
        {enrollments.length === 0 && <p style={{ color: '#888' }}>Not enrolled in any school.</p>}
      </div>

      {/* Belt Progress Summary */}
      {beltProgress.length > 0 && (
        <>
          <h3>Belt Progress</h3>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {beltProgress.map((bp, i) => (
              <div key={i} className="card" style={{ padding: '1rem', minWidth: '220px' }}>
                <div style={{ fontWeight: 600 }}>{bp.programName}</div>
                <div style={{ fontSize: '0.85rem', color: '#888' }}>{bp.schoolName}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%',
                    background: bp.currentBelt?.color || '#ccc', border: '2px solid #333',
                  }} />
                  <strong>{bp.currentBelt?.name || 'No belt'}</strong>
                </div>
                <div style={{ marginTop: '0.5rem' }}>
                  <div style={{ background: '#e2e8f0', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
                    <div style={{ background: '#3b82f6', height: '100%', width: `${bp.progressPercent}%`, transition: 'width 0.3s' }} />
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.25rem' }}>
                    {bp.completedRequirements}/{bp.totalRequirements} requirements ({bp.progressPercent}%)
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Family */}
      {family.length > 0 && (
        <>
          <h3>My Family</h3>
          {family.map((f) => (
            <div key={f.id} className="card" style={{ padding: '0.75rem 1.25rem', marginBottom: '0.5rem' }}>
              <strong>{f.name}</strong> <span style={{ color: '#888' }}>({f.myRole})</span>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.25rem', flexWrap: 'wrap' }}>
                {f.members.map((m) => (
                  <span key={m.id} style={{ fontSize: '0.85rem' }}>{m.user.firstName} {m.user.lastName}</span>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {/* Unread Notifications */}
      {unreadNotifications.length > 0 && (
        <>
          <h3>Recent Alerts</h3>
          {unreadNotifications.slice(0, 5).map((n) => (
            <div key={n.id} style={{ padding: '0.5rem 0.75rem', background: '#eef6ff', borderRadius: '6px', marginBottom: '0.5rem' }}>
              {n.subject && <strong>{n.subject} </strong>}
              <span>{n.body}</span>
              <span style={{ fontSize: '0.8rem', color: '#888', marginLeft: '0.5rem' }}>{new Date(n.createdAt).toLocaleDateString()}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, emoji, color }) {
  return (
    <div className="card" style={{ padding: '1rem', textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem' }}>{emoji}</div>
      <div style={{ fontSize: '1.4rem', fontWeight: 700, color: color || '#1a202c' }}>{value}</div>
      <div style={{ fontSize: '0.8rem', color: '#888' }}>{label}</div>
    </div>
  );
}

// ─── Attendance ──────────────────────────────────────────

function AttendanceTab({ data }) {
  const { attendance } = data;

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <StatCard label="Total Check-ins" value={attendance.totalCheckIns} emoji="✅" />
        <StatCard label="Last 30 Days" value={attendance.last30Days} emoji="📅" />
      </div>

      <h3>Recent Check-ins</h3>
      <table className="data-table">
        <thead>
          <tr><th>Date</th><th>Class</th><th>Method</th></tr>
        </thead>
        <tbody>
          {attendance.recent.map((ci) => (
            <tr key={ci.id}>
              <td>{new Date(ci.checkedInAt).toLocaleString()}</td>
              <td>{ci.session?.class?.name || '—'}</td>
              <td>{ci.method}</td>
            </tr>
          ))}
          {attendance.recent.length === 0 && <tr><td colSpan="3" style={{ textAlign: 'center', color: '#888' }}>No check-ins yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── Billing ─────────────────────────────────────────────

function BillingTab({ data }) {
  const { billing } = data;

  return (
    <div>
      <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '1.5rem' }}>
        <StatCard label="Outstanding Balance" value={`$${billing.outstandingBalance.toFixed(2)}`} emoji="💰" color={billing.outstandingBalance > 0 ? '#e53e3e' : '#38a169'} />
        <StatCard label="Active Subscriptions" value={billing.subscriptions.length} emoji="📋" />
      </div>

      {/* Active Subscriptions */}
      {billing.subscriptions.length > 0 && (
        <>
          <h3>Active Subscriptions</h3>
          <table className="data-table">
            <thead><tr><th>Plan</th><th>School</th><th>Price</th><th>Interval</th></tr></thead>
            <tbody>
              {billing.subscriptions.map((sub) => (
                <tr key={sub.id}>
                  <td>{sub.plan?.name}</td>
                  <td>{sub.school?.name}</td>
                  <td>${Number(sub.plan?.price || 0).toFixed(2)}</td>
                  <td>{sub.plan?.billingCycle}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Invoices */}
      <h3 style={{ marginTop: '1rem' }}>Invoices</h3>
      <table className="data-table">
        <thead><tr><th>Date</th><th>Invoice #</th><th>School</th><th>Amount</th><th>Status</th><th>Due</th></tr></thead>
        <tbody>
          {billing.invoices.map((inv) => (
            <tr key={inv.id} style={{ background: (inv.status === 'PAST_DUE') ? '#fff5f5' : undefined }}>
              <td>{new Date(inv.createdAt).toLocaleDateString()}</td>
              <td>{inv.invoiceNumber}</td>
              <td>{inv.school?.name}</td>
              <td>${Number(inv.totalAmount).toFixed(2)}</td>
              <td>
                <span style={{
                  padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.8rem', color: '#fff',
                  background: inv.status === 'PAID' ? '#38a169' : inv.status === 'PAST_DUE' ? '#e53e3e' : '#dd6b20',
                }}>{inv.status}</span>
              </td>
              <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : '—'}</td>
            </tr>
          ))}
          {billing.invoices.length === 0 && <tr><td colSpan="6" style={{ textAlign: 'center', color: '#888' }}>No invoices</td></tr>}
        </tbody>
      </table>

      {/* Payments */}
      <h3 style={{ marginTop: '1rem' }}>Payment History</h3>
      <table className="data-table">
        <thead><tr><th>Date</th><th>Amount</th><th>Method</th><th>Invoice</th></tr></thead>
        <tbody>
          {billing.payments.map((pay) => (
            <tr key={pay.id}>
              <td>{new Date(pay.paidAt).toLocaleDateString()}</td>
              <td>${Number(pay.amount).toFixed(2)}</td>
              <td>{pay.method}</td>
              <td>{pay.invoice?.invoiceNumber || '—'}</td>
            </tr>
          ))}
          {billing.payments.length === 0 && <tr><td colSpan="4" style={{ textAlign: 'center', color: '#888' }}>No payments yet</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

// ─── Belt Progress ───────────────────────────────────────

function BeltProgressTab({ data }) {
  const { beltProgress } = data;

  if (beltProgress.length === 0) {
    return <p style={{ color: '#888' }}>You're not enrolled in any belt programs yet.</p>;
  }

  return (
    <div>
      {beltProgress.map((bp, i) => (
        <div key={i} style={{ marginBottom: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: bp.currentBelt?.color || '#ccc', border: '2px solid #333' }} />
            <div>
              <h3 style={{ margin: 0 }}>{bp.programName}</h3>
              <div style={{ color: '#888', fontSize: '0.85rem' }}>
                {bp.schoolName} — Current: <strong>{bp.currentBelt?.name || 'None'}</strong>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          <div style={{ marginBottom: '1rem' }}>
            <div style={{ background: '#e2e8f0', borderRadius: '6px', height: '12px', overflow: 'hidden' }}>
              <div style={{ background: '#3b82f6', height: '100%', width: `${bp.progressPercent}%`, transition: 'width 0.3s' }} />
            </div>
            <div style={{ fontSize: '0.85rem', color: '#666', marginTop: '0.25rem' }}>
              {bp.completedRequirements} of {bp.totalRequirements} requirements completed ({bp.progressPercent}%)
            </div>
          </div>

          {/* Requirements */}
          {bp.requirements.length > 0 && (
            <>
              <h4>Requirements</h4>
              <table className="data-table">
                <thead><tr><th>Requirement</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  {bp.requirements.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{r.requirement.description}</strong>
                      </td>
                      <td>{r.requirement.type}</td>
                      <td>
                        <span style={{
                          padding: '0.15rem 0.5rem', borderRadius: '20px', fontSize: '0.8rem', color: '#fff',
                          background: r.isComplete ? '#38a169' : '#dd6b20',
                        }}>{r.isComplete ? 'Complete' : 'In Progress'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {/* Promotion History */}
          {bp.promotionHistory.length > 0 && (
            <>
              <h4 style={{ marginTop: '1rem' }}>Promotion History</h4>
              <table className="data-table">
                <thead><tr><th>Date</th><th>From</th><th>To</th></tr></thead>
                <tbody>
                  {bp.promotionHistory.map((p) => (
                    <tr key={p.id}>
                      <td>{new Date(p.promotedAt).toLocaleDateString()}</td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.fromBelt?.color || '#ccc', display: 'inline-block' }} />
                          {p.fromBelt?.name}
                        </span>
                      </td>
                      <td>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                          <span style={{ width: 12, height: 12, borderRadius: '50%', background: p.toBelt?.color || '#ccc', display: 'inline-block' }} />
                          {p.toBelt?.name}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Schedule ────────────────────────────────────────────

function ScheduleTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentPortalApi.getSchedule()
      .then(setSessions)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Loading schedule…</p>;

  return (
    <div>
      <h3>Upcoming Classes</h3>
      {sessions.length === 0 ? (
        <p style={{ color: '#888' }}>No upcoming classes scheduled.</p>
      ) : (
        <table className="data-table">
          <thead><tr><th>Date</th><th>Time</th><th>Class</th><th>School</th><th>Instructor</th><th>Attended</th></tr></thead>
          <tbody>
            {sessions.map((s) => (
              <tr key={s.id}>
                <td>{new Date(s.sessionDate).toLocaleDateString()}</td>
                <td>{s.startTime}–{s.endTime}</td>
                <td>{s.class?.name}</td>
                <td>{s.class?.school?.name}</td>
                <td>{s.class?.instructor ? `${s.class.instructor.firstName} ${s.class.instructor.lastName}` : '—'}</td>
                <td>{s.attended ? '✅' : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
