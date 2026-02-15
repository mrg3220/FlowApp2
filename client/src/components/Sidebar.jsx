import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { displayRole } from '../utils/displayRole';

export default function Sidebar() {
  const { user, logout, isSuperAdmin, isOwner, isStaff } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <aside className="app-sidebar">
      <div className="logo">
        Flow<span>App</span>
      </div>
      <nav>
        <NavLink to="/dashboard" className={({ isActive }) => (isActive ? 'active' : '')}>
          📊 Dashboard
        </NavLink>

        {(isSuperAdmin || isOwner) && (
          <NavLink to="/schools" className={({ isActive }) => (isActive ? 'active' : '')}>
            🏫 Schools
          </NavLink>
        )}

        <NavLink to="/classes" className={({ isActive }) => (isActive ? 'active' : '')}>
          🥋 Classes
        </NavLink>
        <NavLink to="/sessions" className={({ isActive }) => (isActive ? 'active' : '')}>
          📅 Sessions
        </NavLink>

        {isStaff && (
          <NavLink to="/checkin" className={({ isActive }) => (isActive ? 'active' : '')}>
            ✅ Check In
          </NavLink>
        )}
        {isStaff && (
          <NavLink to="/kiosk" className={({ isActive }) => (isActive ? 'active' : '')}>
            🖥️ Kiosk
          </NavLink>
        )}

        <NavLink to="/metrics" className={({ isActive }) => (isActive ? 'active' : '')}>
          📈 Metrics
        </NavLink>
        <NavLink to="/promotions" className={({ isActive }) => (isActive ? 'active' : '')}>
          🥋 Promotions
        </NavLink>
        <NavLink to="/billing" className={({ isActive }) => (isActive ? 'active' : '')}>
          💰 Billing
        </NavLink>
        <NavLink to="/notifications" className={({ isActive }) => (isActive ? 'active' : '')}>
          🔔 Notifications
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => (isActive ? 'active' : '')}>
          👤 Profile
        </NavLink>
      </nav>
      <div className="user-info">
        <div className="user-name">{user?.firstName} {user?.lastName}</div>
        <div className="user-role">{displayRole(user?.role)}</div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%' }} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
