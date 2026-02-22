import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { displayRole, displayTitle } from '../utils/displayRole';

function SidebarSection({ title, children }) {
  return (
    <div style={{ marginBottom: '0.25rem' }}>
      {title && (
        <div style={{ fontSize: '0.65rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8892a4', padding: '0.5rem 1rem 0.15rem' }}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
}

function SLink({ to, icon, label }) {
  return (
    <NavLink to={to} className={({ isActive }) => (isActive ? 'active' : '')}>
      {icon} {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { user, logout, isSuperAdmin, isOwner, isInstructor, isStudent, isEventCoordinator, isMarketing, isSchoolStaff, isStaff, isHQ, isITAdmin, isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userTitle = displayTitle(user?.title);

  return (
    <aside className="app-sidebar">
      <div className="logo">Flow<span>App</span></div>
      <nav>
        {/* Everyone */}
        <SLink to="/dashboard" icon="📊" label="Dashboard" />

        {/* HQ / Organization */}
        {(isSuperAdmin || isHQ) && (
          <SidebarSection title="Headquarters">
            {isSuperAdmin && <SLink to="/schools" icon="🏫" label="Schools" />}
            {(isSuperAdmin || isMarketing) && <SLink to="/branding" icon="🎨" label="Branding" />}
            {isSuperAdmin && <SLink to="/reporting" icon="📊" label="Reports" />}
            {isSuperAdmin && <SLink to="/certifications" icon="🏅" label="Certifications" />}
          </SidebarSection>
        )}

        {/* Events */}
        {(isSuperAdmin || isEventCoordinator || isOwner) && (
          <SidebarSection title="Events">
            <SLink to="/events" icon="🎪" label="Events" />
          </SidebarSection>
        )}

        {/* School Management */}
        {(isOwner || isSchoolStaff || isInstructor) && (
          <SidebarSection title="School Management">
            <SLink to="/programs" icon="🥋" label="Programs" />
            <SLink to="/classes" icon="📅" label="Classes" />
            <SLink to="/calendar" icon="🗓️" label="Calendar" />
            <SLink to="/checkin" icon="✅" label="Check In" />
            {isStaff && <SLink to="/kiosk" icon="🖥️" label="Kiosk" />}
            {(isOwner || isSchoolStaff) && <SLink to="/leads" icon="📋" label="CRM / Leads" />}
            {(isOwner || isSchoolStaff) && <SLink to="/families" icon="👨‍👩‍👧‍👦" label="Families" />}
          </SidebarSection>
        )}

        {/* Teaching & Training */}
        {isStaff && (
          <SidebarSection title="Teaching">
            <SLink to="/curriculum" icon="📚" label="Curriculum" />
            <SLink to="/promotions" icon="🥋" label="Promotions" />
            <SLink to="/training-plans" icon="🏋️" label="Training Plans" />
            <SLink to="/certificates" icon="📜" label="Certificates" />
            <SLink to="/virtual" icon="📺" label="Virtual Classes" />
          </SidebarSection>
        )}

        {/* Student */}
        {isStudent && (
          <SidebarSection title="My Training">
            <SLink to="/student-portal" icon="🎓" label="My Portal" />
            <SLink to="/programs" icon="🥋" label="Programs" />
            <SLink to="/classes" icon="📅" label="Classes" />
            <SLink to="/calendar" icon="🗓️" label="Calendar" />
            <SLink to="/events" icon="🎪" label="Events" />
            <SLink to="/curriculum" icon="📚" label="Curriculum" />
            <SLink to="/virtual" icon="📺" label="Virtual Classes" />
            <SLink to="/training-plans" icon="🏋️" label="Training Plans" />
            <SLink to="/certifications" icon="🏅" label="Apply for Title" />
          </SidebarSection>
        )}

        {/* Business */}
        {(isSuperAdmin || isOwner || isSchoolStaff) && (
          <SidebarSection title="Business">
            <SLink to="/metrics" icon="📈" label="Metrics" />
            <SLink to="/billing" icon="💰" label="Billing" />
            <SLink to="/shop" icon="🛍️" label="Shop" />
            {(isSuperAdmin || isOwner) && <SLink to="/payroll" icon="💵" label="Payroll" />}
            <SLink to="/waivers" icon="📝" label="Waivers" />
          </SidebarSection>
        )}

        {/* Marketing */}
        {isMarketing && (
          <SidebarSection title="Marketing">
            <SLink to="/shop" icon="🛍️" label="Org Merch" />
            <SLink to="/help" icon="❓" label="Help Articles" />
          </SidebarSection>
        )}

        {/* Student account/business */}
        {isStudent && (
          <SidebarSection title="Account">
            <SLink to="/billing" icon="💰" label="My Billing" />
            <SLink to="/shop" icon="🛍️" label="Shop" />
            <SLink to="/waivers" icon="📝" label="Waivers" />
            <SLink to="/families" icon="👨‍👩‍👧‍👦" label="Family" />
          </SidebarSection>
        )}

        {/* IT Admin / SRE */}
        {(isSuperAdmin || isITAdmin) && (
          <SidebarSection title="Administration">
            <SLink to="/it-admin" icon="🔧" label="IT Admin" />
            <SLink to="/sre" icon="📡" label="SRE Dashboard" />
          </SidebarSection>
        )}

        {/* Common */}
        <SidebarSection title="">
          <SLink to="/notifications" icon="🔔" label="Notifications" />
          <SLink to="/help" icon="❓" label="Help Center" />
          <SLink to="/profile" icon="👤" label="Profile" />
        </SidebarSection>
      </nav>
      <div className="user-info">
        <div className="user-name">{user?.firstName} {user?.lastName}</div>
        <div className="user-role">
          {displayRole(user?.role)}
          {userTitle && <span style={{ display: 'block', fontSize: '0.75rem', color: '#e94560', fontWeight: 600 }}>{userTitle}</span>}
        </div>
        <button className="btn btn-outline btn-sm" style={{ marginTop: '0.5rem', width: '100%' }} onClick={handleLogout}>
          Logout
        </button>
      </div>
    </aside>
  );
}
