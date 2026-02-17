import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { sessionApi, eventApi, classApi, promotionApi } from '../api/client';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// Convert 24h "HH:mm" to 12h "h:mm AM/PM"
const formatTime12h = (time24) => {
  if (!time24) return '';
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m.toString().padStart(2, '0')} ${ampm}`;
};

export default function CalendarPage() {
  const { user } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState('month'); // 'month' | 'week'
  const [sessions, setSessions] = useState([]);
  const [events, setEvents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [promotions, setPromotions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [filters, setFilters] = useState({ sessions: true, events: true, promotions: true });

  useEffect(() => {
    loadData();
  }, [currentDate]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      // Get dates for the current view range
      const start = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const end = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
      
      const params = {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };

      const [sessionsData, eventsData, classesData] = await Promise.all([
        sessionApi.getAll(params).catch(() => []),
        eventApi.getAll(params).catch(() => []),
        classApi.getAll().catch(() => []),
      ]);

      setSessions(sessionsData);
      setEvents(eventsData);
      setClasses(classesData);
      // Belt tests would need schoolId - skip for now
      setPromotions([]);
    } catch (err) {
      setError(`Failed to load calendar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate calendar days
  const calendarDays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    
    const days = [];
    
    // Previous month padding
    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = startOffset - 1; i >= 0; i--) {
      days.push({ date: new Date(year, month - 1, prevMonthLastDay - i), isCurrentMonth: false });
    }
    
    // Current month days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), isCurrentMonth: true });
    }
    
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ date: new Date(year, month + 1, i), isCurrentMonth: false });
    }
    
    return days;
  }, [currentDate]);

  // Get events for a specific date
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    const items = [];

    // Class sessions
    if (filters.sessions) {
      sessions.forEach((s) => {
        const sessionDate = new Date(s.sessionDate).toISOString().split('T')[0];
        if (sessionDate === dateStr) {
          const cls = classes.find((c) => c.id === s.classId);
          items.push({
            id: `session-${s.id}`,
            type: 'session',
            title: cls?.name || 'Class Session',
            time: s.startTime,
            color: '#2196f3',
            data: { ...s, class: cls },
          });
        }
      });
    }

    // Scheduled classes (recurring)
    if (filters.sessions && date >= new Date()) {
      const dayIndex = date.getDay();
      const dayMap = { 0: 'SUN', 1: 'MON', 2: 'TUE', 3: 'WED', 4: 'THU', 5: 'FRI', 6: 'SAT' };
      classes.forEach((cls) => {
        cls.schedules?.forEach((schedule) => {
          if (schedule.dayOfWeek === dayMap[dayIndex]) {
            // Check if there's not already a session for this
            const hasSession = sessions.some(
              (s) => s.classId === cls.id && new Date(s.sessionDate).toISOString().split('T')[0] === dateStr
            );
            if (!hasSession) {
              items.push({
                id: `schedule-${cls.id}-${schedule.id}-${dateStr}`,
                type: 'scheduled',
                title: `${cls.name} (Recurring)`,
                time: schedule.startTime,
                color: '#9c27b0',
                data: { class: cls, schedule },
              });
            }
          }
        });
      });
    }

    // Events
    if (filters.events) {
      events.forEach((e) => {
        const eventDate = new Date(e.startDate).toISOString().split('T')[0];
        if (eventDate === dateStr) {
          items.push({
            id: `event-${e.id}`,
            type: 'event',
            title: e.name,
            time: e.startTime || '09:00',
            color: '#ff9800',
            data: e,
          });
        }
      });
    }

    // Promotions
    if (filters.promotions) {
      promotions.forEach((p) => {
        if (p.scheduledDate) {
          const promoDate = new Date(p.scheduledDate).toISOString().split('T')[0];
          if (promoDate === dateStr) {
            items.push({
              id: `promo-${p.id}`,
              type: 'promotion',
              title: `🥋 ${p.student?.firstName || 'Promotion'} → ${p.toBelt?.name || 'Belt Test'}`,
              time: '10:00',
              color: '#4caf50',
              data: p,
            });
          }
        }
      });
    }

    return items.sort((a, b) => a.time.localeCompare(b.time));
  };

  const navigateMonth = (delta) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + delta, 1));
  };

  const goToToday = () => setCurrentDate(new Date());

  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <h1>📅 Calendar</h1>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-outline" onClick={() => navigateMonth(-1)}>◀</button>
          <button className="btn btn-outline" onClick={goToToday}>Today</button>
          <button className="btn btn-outline" onClick={() => navigateMonth(1)}>▶</button>
          <span style={{ fontWeight: 600, fontSize: '1.1rem', minWidth: '180px', textAlign: 'center' }}>
            {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
        </div>
      </div>

      {error && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '1rem', marginBottom: '1rem', color: '#991b1b' }}>
          {error}
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.sessions} onChange={(e) => setFilters({ ...filters, sessions: e.target.checked })} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#2196f3' }} />
            Class Sessions
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.events} onChange={(e) => setFilters({ ...filters, events: e.target.checked })} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#ff9800' }} />
            Events
          </span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={filters.promotions} onChange={(e) => setFilters({ ...filters, promotions: e.target.checked })} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
            <span style={{ width: '12px', height: '12px', borderRadius: '3px', background: '#4caf50' }} />
            Belt Tests
          </span>
        </label>
      </div>

      {/* Calendar Grid */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {loading && (
          <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>Loading calendar...</div>
        )}
        
        {!loading && (
          <>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #e0e0e0' }}>
              {DAYS.map((d) => (
                <div key={d} style={{ padding: '0.75rem', textAlign: 'center', fontWeight: 600, background: '#f5f5f5', fontSize: '0.85rem' }}>
                  {d}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {calendarDays.map((day, idx) => {
                const dayEvents = getEventsForDate(day.date);
                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: '100px',
                      borderRight: (idx + 1) % 7 !== 0 ? '1px solid #e0e0e0' : 'none',
                      borderBottom: idx < 35 ? '1px solid #e0e0e0' : 'none',
                      background: isToday(day.date) ? '#e3f2fd' : day.isCurrentMonth ? '#fff' : '#fafafa',
                      padding: '0.25rem',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: isToday(day.date) ? 700 : 400,
                        color: day.isCurrentMonth ? (isToday(day.date) ? '#1565c0' : '#333') : '#999',
                        fontSize: '0.85rem',
                        padding: '0.25rem',
                      }}
                    >
                      {day.date.getDate()}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {dayEvents.slice(0, 3).map((evt) => (
                        <div
                          key={evt.id}
                          onClick={() => setSelectedEvent(evt)}
                          style={{
                            background: evt.color,
                            color: '#fff',
                            padding: '2px 4px',
                            borderRadius: '3px',
                            fontSize: '0.7rem',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`${formatTime12h(evt.time)} - ${evt.title}`}
                        >
                          {formatTime12h(evt.time)} {evt.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div style={{ fontSize: '0.7rem', color: '#666', paddingLeft: '4px' }}>
                          +{dayEvents.length - 3} more
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Legend */}
      <div style={{ marginTop: '1rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', color: '#666' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#2196f3' }} /> Class Sessions
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#9c27b0' }} /> Recurring (Scheduled)
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#ff9800' }} /> Events
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ width: '16px', height: '16px', borderRadius: '4px', background: '#4caf50' }} /> Belt Tests
        </span>
      </div>

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setSelectedEvent(null); }}>
          <div className="modal" style={{ maxWidth: '500px' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ width: '20px', height: '20px', borderRadius: '4px', background: selectedEvent.color }} />
              {selectedEvent.title}
            </h2>
            <div style={{ marginTop: '1rem' }}>
              <p><strong>Time:</strong> {formatTime12h(selectedEvent.time)}</p>
              <p><strong>Type:</strong> {selectedEvent.type === 'session' ? 'Class Session' : selectedEvent.type === 'scheduled' ? 'Recurring Class' : selectedEvent.type === 'event' ? 'Event' : 'Belt Test'}</p>
              
              {selectedEvent.type === 'session' && selectedEvent.data.class && (
                <>
                  <p><strong>Instructor:</strong> {selectedEvent.data.class.instructor?.firstName} {selectedEvent.data.class.instructor?.lastName}</p>
                  <p><strong>Program:</strong> {selectedEvent.data.class.discipline}</p>
                  <p><strong>Status:</strong> {selectedEvent.data.status}</p>
                </>
              )}

              {selectedEvent.type === 'scheduled' && selectedEvent.data.class && (
                <>
                  <p><strong>Instructor:</strong> {selectedEvent.data.class.instructor?.firstName} {selectedEvent.data.class.instructor?.lastName}</p>
                  <p><strong>Program:</strong> {selectedEvent.data.class.discipline}</p>
                  <p><strong>Every:</strong> {selectedEvent.data.schedule.dayOfWeek}</p>
                </>
              )}

              {selectedEvent.type === 'event' && (
                <>
                  <p><strong>Location:</strong> {selectedEvent.data.location || 'TBD'}</p>
                  <p><strong>Description:</strong> {selectedEvent.data.description || 'No description'}</p>
                </>
              )}

              {selectedEvent.type === 'promotion' && (
                <>
                  <p><strong>Student:</strong> {selectedEvent.data.student?.firstName} {selectedEvent.data.student?.lastName}</p>
                  <p><strong>From:</strong> {selectedEvent.data.fromBelt?.name || 'N/A'}</p>
                  <p><strong>To:</strong> {selectedEvent.data.toBelt?.name || 'N/A'}</p>
                </>
              )}
            </div>
            <div style={{ marginTop: '1.5rem' }}>
              <button className="btn btn-outline" onClick={() => setSelectedEvent(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
