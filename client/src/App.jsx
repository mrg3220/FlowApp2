import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import AIChat from './components/AIChat';
import OnboardingWizard from './components/OnboardingWizard';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ClassesPage from './pages/ClassesPage';
import ProgramsPage from './pages/ProgramsPage';
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
import VirtualClassesPage from './pages/VirtualClassesPage';
import EventsPage from './pages/EventsPage';
import CertificationsPage from './pages/CertificationsPage';
import BrandingPage from './pages/BrandingPage';
import CalendarPage from './pages/CalendarPage';
import HelpCenterPage from './pages/HelpCenterPage';
import PublicEventsPage from './pages/PublicEventsPage';
import PublicShopPage from './pages/PublicShopPage';
import ITAdminPage from './pages/ITAdminPage';
import SREDashboardPage from './pages/SREDashboardPage';

function AppLayout({ children }) {
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        {children}
        <OnboardingWizard />
        <AIChat />
      </main>
    </div>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <ErrorBoundary>
    <Routes>
      {/* Public routes — no auth required */}
      <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <RegisterPage />} />
      <Route path="/kiosk" element={<KioskPage />} />
      <Route path="/public/events" element={<PublicEventsPage />} />
      <Route path="/public/shop" element={<PublicShopPage />} />

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
        path="/programs"
        element={
          <ProtectedRoute>
            <AppLayout><ProgramsPage /></AppLayout>
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
      {/* Legacy redirect from /sessions to /classes */}
      <Route path="/sessions" element={<Navigate to="/classes" />} />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <AppLayout><CalendarPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkin"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'SCHOOL_STAFF']}>
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
          <ProtectedRoute roles={['SUPER_ADMIN', 'OWNER', 'INSTRUCTOR', 'SCHOOL_STAFF']}>
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
        path="/virtual"
        element={
          <ProtectedRoute>
            <AppLayout><VirtualClassesPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/events"
        element={
          <ProtectedRoute>
            <AppLayout><EventsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/certifications"
        element={
          <ProtectedRoute>
            <AppLayout><CertificationsPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/branding"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'MARKETING', 'OWNER', 'SCHOOL_STAFF']}>
            <AppLayout><BrandingPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/help"
        element={
          <ProtectedRoute>
            <AppLayout><HelpCenterPage /></AppLayout>
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
      <Route
        path="/it-admin"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN']}>
            <AppLayout><ITAdminPage /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/sre"
        element={
          <ProtectedRoute roles={['SUPER_ADMIN', 'IT_ADMIN']}>
            <AppLayout><SREDashboardPage /></AppLayout>
          </ProtectedRoute>
        }
      />

      {/* Default redirect */}
      <Route path="*" element={<Navigate to={user ? '/dashboard' : '/login'} />} />
    </Routes>
    </ErrorBoundary>
  );
}
