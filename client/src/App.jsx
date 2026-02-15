import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import SessionsPage from './pages/SessionsPage';
import CheckInPage from './pages/CheckInPage';
import KioskPage from './pages/KioskPage';
import SchoolsPage from './pages/SchoolsPage';
import ProfilePage from './pages/ProfilePage';
import MetricsPage from './pages/MetricsPage';
import BillingPage from './pages/BillingPage';
import PromotionsPage from './pages/PromotionsPage';
import NotificationsPage from './pages/NotificationsPage';
import FamiliesPage from './pages/FamiliesPage';
import StudentPortalPage from './pages/StudentPortalPage';
import LeadsPage from './pages/LeadsPage';
import CurriculumPage from './pages/CurriculumPage';
import ReportingPage from './pages/ReportingPage';
import WaiversPage from './pages/WaiversPage';
import RetailPage from './pages/RetailPage';
import CertificatesPage from './pages/CertificatesPage';
import TrainingPlansPage from './pages/TrainingPlansPage';
import PayrollPage from './pages/PayrollPage';
import CompetitionsPage from './pages/CompetitionsPage';
import VirtualClassesPage from './pages/VirtualClassesPage';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">{children}</main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/kiosk" element={<KioskPage />} />

      {/* Protected routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout><DashboardPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/schools"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER']}>
            <AppLayout><SchoolsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/classes"
        element={
          <ProtectedRoute>
            <AppLayout><ClassesPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sessions"
        element={
          <ProtectedRoute>
            <AppLayout><SessionsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER', 'INSTRUCTOR']}>
            <AppLayout><CheckInPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/metrics"
        element={
          <ProtectedRoute>
            <AppLayout><MetricsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/billing"
        element={
          <ProtectedRoute>
            <AppLayout><BillingPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/promotions"
        element={
          <ProtectedRoute>
            <AppLayout><PromotionsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <AppLayout><NotificationsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/families"
        element={
          <ProtectedRoute>
            <AppLayout><FamiliesPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/student-portal"
        element={
          <ProtectedRoute>
            <AppLayout><StudentPortalPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/leads"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER', 'INSTRUCTOR']}>
            <AppLayout><LeadsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/curriculum"
        element={
          <ProtectedRoute>
            <AppLayout><CurriculumPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/reporting"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER']}>
            <AppLayout><ReportingPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/waivers"
        element={
          <ProtectedRoute>
            <AppLayout><WaiversPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/shop"
        element={
          <ProtectedRoute>
            <AppLayout><RetailPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/certificates"
        element={
          <ProtectedRoute>
            <AppLayout><CertificatesPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/training-plans"
        element={
          <ProtectedRoute>
            <AppLayout><TrainingPlansPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/payroll"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER']}>
            <AppLayout><PayrollPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/competitions"
        element={
          <ProtectedRoute>
            <AppLayout><CompetitionsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/virtual"
        element={
          <ProtectedRoute>
            <AppLayout><VirtualClassesPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute>
            <AppLayout><ProfilePage /></AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
    </Routes>
  );
}
