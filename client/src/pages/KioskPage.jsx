import { useState, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { sessionApi, checkInApi } from '../api/client';
import { useAuth } from '../context/AuthContext';

/**
 * Kiosk mode — designed for a tablet at the front desk.
 * - Owners/Instructors can set up kiosk (select session, configure mode)
 * - Students check in by email or scanning QR code
 */
export default function KioskPage() {
  const { user, isStaff } = useAuth();
  const [mode, setMode] = useState('setup'); // 'setup' | 'checkin'
  const [checkInMethod, setCheckInMethod] = useState('email'); // 'email' | 'qr'
  const [sessions, setSessions] = useState([]);
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedSessionData, setSelectedSessionData] = useState(null);
  const [email, setEmail] = useState('');
  const [qrValue, setQrValue] = useState('');
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const today = new Date().toISOString().split('T')[0];
        const data = await sessionApi.getAll({ from: today, to: today });
        const active = data.filter((s) => s.status !== 'CANCELLED' && s.status !== 'COMPLETED');
        setSessions(active);
        if (active.length === 1) {
          setSelectedSession(active[0].id);
          setSelectedSessionData(active[0]);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  const handleSessionSelect = (sessionId) => {
    setSelectedSession(sessionId);
    setSelectedSessionData(sessions.find((s) => s.id === sessionId) || null);
  };

  const launchKiosk = () => {
    if (!selectedSession) {
      setMessage({ type: 'error', text: 'Please select a session first' });
      return;
    }
    setMode('checkin');
    setMessage({ type: '', text: '' });
  };

  const handleEmailCheckIn = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!selectedSession) {
      setMessage({ type: 'error', text: 'Please select a class' });
      return;
    }

    try {
      const result = await checkInApi.checkInByKiosk(selectedSession, email);
      setMessage({
        type: 'success',
        text: `Welcome, ${result.student.firstName}! You're checked into ${result.className}.`,
      });
      setEmail('');
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  const handleQrCheckIn = async (e) => {
    e.preventDefault();
    setMessage({ type: '', text: '' });

    if (!qrValue.trim()) {
      setMessage({ type: 'error', text: 'Please enter or scan a QR code' });
      return;
    }

    try {
      const result = await checkInApi.checkInByKiosk(selectedSession, qrValue.trim());
      setMessage({
        type: 'success',
        text: `Welcome, ${result.student.firstName}! You're checked into ${result.className}.`,
      });
      setQrValue('');
      setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    }
  };

  if (loading) return <div className="loading">Loading kiosk...</div>;

  // ─── Setup Mode (Owner/Instructor only) ──────────────

  if (mode === 'setup') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'var(--color-primary)',
        padding: '2rem',
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '3rem',
          width: '100%',
          maxWidth: '550px',
          boxShadow: 'var(--shadow-lg)',
        }}>
          <h1 style={{ fontSize: '2.5rem', textAlign: 'center', marginBottom: '0.5rem' }}>🥋</h1>
          <h2 style={{ fontSize: '1.5rem', textAlign: 'center', marginBottom: '0.25rem' }}>Kiosk Setup</h2>
          <p style={{ color: 'var(--color-text-light)', textAlign: 'center', marginBottom: '2rem' }}>
            {isStaff ? 'Configure the check-in kiosk' : 'Select a session to check in'}
          </p>

          {message.text && (
            <div className={`alert alert-${message.type}`}>{message.text}</div>
          )}

          <div className="form-group">
            <label>Select Today's Session</label>
            <select
              className="form-control"
              value={selectedSession}
              onChange={(e) => handleSessionSelect(e.target.value)}
              style={{ fontSize: '1.1rem', padding: '0.8rem' }}
            >
              <option value="">Choose a session...</option>
              {sessions.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.class.name} — {s.startTime} ({s._count?.checkIns || 0}/{s.class.capacity})
                </option>
              ))}
            </select>
          </div>

          {sessions.length === 0 && (
            <p style={{ color: 'var(--color-text-light)', textAlign: 'center', fontSize: '1.1rem' }}>
              No active sessions right now.
            </p>
          )}

          {isStaff && sessions.length > 0 && (
            <>
              <div className="form-group">
                <label>Check-in Method</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className={`btn ${checkInMethod === 'email' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setCheckInMethod('email')}
                  >
                    📧 Email
                  </button>
                  <button
                    className={`btn ${checkInMethod === 'qr' ? 'btn-primary' : 'btn-outline'}`}
                    style={{ flex: 1, justifyContent: 'center' }}
                    onClick={() => setCheckInMethod('qr')}
                  >
                    📱 QR Code
                  </button>
                </div>
              </div>

              <button
                className="btn btn-success"
                style={{ width: '100%', padding: '0.9rem', fontSize: '1.2rem', justifyContent: 'center', marginTop: '1rem' }}
                onClick={launchKiosk}
              >
                🚀 Launch Kiosk
              </button>
            </>
          )}

          {!isStaff && sessions.length > 0 && (
            <button
              className="btn btn-success"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.2rem', justifyContent: 'center', marginTop: '1rem' }}
              onClick={launchKiosk}
            >
              Continue to Check-In
            </button>
          )}
        </div>
      </div>
    );
  }

  // ─── Check-In Mode ────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'var(--color-primary)',
      padding: '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '3rem',
        width: '100%',
        maxWidth: '500px',
        textAlign: 'center',
        boxShadow: 'var(--shadow-lg)',
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🥋</h1>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>FlowApp Check-In</h2>

        {selectedSessionData && (
          <p style={{ fontWeight: '600', fontSize: '1.2rem', marginBottom: '0.5rem', color: 'var(--color-accent)' }}>
            {selectedSessionData.class.name} — {selectedSessionData.startTime}
          </p>
        )}

        <p style={{ color: 'var(--color-text-light)', marginBottom: '1.5rem' }}>
          {checkInMethod === 'email' ? 'Enter your email to check in' : 'Enter your email (or scan QR with a reader)'}
        </p>

        {message.text && (
          <div className={`alert alert-${message.type}`} style={{ fontSize: '1.1rem' }}>
            {message.text}
          </div>
        )}

        {checkInMethod === 'email' ? (
          <form onSubmit={handleEmailCheckIn}>
            <div className="form-group">
              <input
                type="email"
                className="form-control"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                style={{ fontSize: '1.2rem', padding: '0.8rem', textAlign: 'center' }}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-success"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.2rem', justifyContent: 'center' }}
            >
              ✅ Check In
            </button>
          </form>
        ) : (
          <form onSubmit={handleQrCheckIn}>
            {/* Display session QR code for students to scan */}
            {selectedSessionData && (
              <div style={{ marginBottom: '1.5rem' }}>
                <p style={{ fontWeight: '600', marginBottom: '0.75rem' }}>Session QR Code</p>
                <div style={{ display: 'inline-block', padding: '1rem', background: 'white', borderRadius: '8px', border: '2px solid var(--color-border)' }}>
                  <QRCodeSVG value={selectedSessionData.qrCode || selectedSessionData.id} size={200} />
                </div>
              </div>
            )}

            <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              — or enter your email below —
            </p>
            <div className="form-group">
              <input
                type="email"
                className="form-control"
                value={qrValue}
                onChange={(e) => setQrValue(e.target.value)}
                placeholder="your.email@example.com"
                style={{ fontSize: '1.2rem', padding: '0.8rem', textAlign: 'center' }}
                required
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="btn btn-success"
              style={{ width: '100%', padding: '0.9rem', fontSize: '1.2rem', justifyContent: 'center' }}
            >
              ✅ Check In
            </button>
          </form>
        )}

        <button
          className="btn btn-outline"
          style={{ marginTop: '1.5rem', width: '100%', justifyContent: 'center' }}
          onClick={() => setMode('setup')}
        >
          ← Back to Setup
        </button>
      </div>
    </div>
  );
}
