import { ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { UserRole } from './models/types';
import { WebSocketProvider } from './context/WebSocketContext';
import { Toaster } from 'sonner';

import ErrorBoundary from './components/ErrorBoundary';
import { AppShell } from './components/layout/AppShell';

import LoginPage from './views/LoginPage';
import PatientFormPage from './views/PatientForm';
import PrescriptionList from './views/PrescriptionList';
import PrescriptionFormPage from './views/PrescriptionForm';
import PrescriptionDetailPage from './views/PrescriptionDetailPage';
import AuditQueue from './views/AuditQueue';
import AnalyticsDashboard from './views/AnalyticsDashboard';
import UserManagement from './views/UserManagement';
import SLAConfigPage from './views/SLAConfigPage';
import SystemStatusPage from './views/SystemStatusPage';
import BillingPage from './views/BillingPage';
import BedManagement from './views/BedManagement';
import ConsultationRoomManagement from './views/ConsultationRoomManagement';
import ConsultationRoom from './views/ConsultationRoom';
import VisitManagement from './views/VisitManagement';
import VisitDetailPage from './views/VisitDetailPage';
import PatientJourneyPage from './views/PatientJourneyPage';
import TriagePage from './views/TriagePage';
import TriageQueuePage from './views/TriageQueuePage';
import PharmacyQueuePage from './views/PharmacyQueuePage';
import SettingsPage from './views/SettingsPage';
import PatientDetailPage from './views/PatientDetailPage';

import {
  AdminDashboard,
  AuditorDashboard,
  BillingClerkDashboard,
  DoctorDashboard,
  PharmacistDashboard,
  WardNurseDashboard,
  ReceptionistDashboard,
} from './views/dashboards';


interface ProtectedRouteProps {
  children: ReactNode;
  roles?: UserRole[];
}

function ProtectedRoute({ children, roles }: ProtectedRouteProps) {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[var(--bg-base)] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div
            className="w-8 h-8 rounded-full border-2 border-[var(--border-default)] animate-spin"
            style={{ borderTopColor: 'var(--clinical-600)' }}
          />
          <p className="text-caption text-[var(--text-disabled)]">Loading workstation</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}

function PageContainer({ children }: { children: ReactNode }) {
  return (
    <div className="w-full px-6 py-6">{children}</div>
  );
}

function RoleBasedDashboard() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;

  const dashboards: Partial<Record<UserRole, React.ComponentType>> = {
    admin:        AdminDashboard,
    auditor:      AuditorDashboard,
    billing:      BillingClerkDashboard,
    doctor:       DoctorDashboard,
    pharmacist:   PharmacistDashboard,
    nurse:        WardNurseDashboard,
    receptionist: ReceptionistDashboard,
  };

  const DashboardComponent = dashboards[user.role];
  if (!DashboardComponent) return <Navigate to="/login" replace />;
  return <DashboardComponent />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppShell>
              <RoleBasedDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/patients"
        element={
          <ProtectedRoute roles={['receptionist', 'admin', 'doctor', 'nurse']}>
            <AppShell>
              <PageContainer><PatientFormPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/patients/:id"
        element={
          <ProtectedRoute roles={['receptionist', 'admin', 'doctor', 'nurse', 'auditor']}>
            <AppShell>
              <PageContainer><PatientDetailPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/prescriptions"
        element={
          <ProtectedRoute roles={['doctor', 'pharmacist', 'nurse', 'auditor', 'admin', 'receptionist']}>
            <AppShell>
              <PageContainer><PrescriptionList /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/prescriptions/new"
        element={
          <ProtectedRoute roles={['doctor', 'admin', 'nurse']}>
            <AppShell>
              <PageContainer><PrescriptionFormPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/prescriptions/:id"
        element={
          <ProtectedRoute roles={['doctor', 'pharmacist', 'nurse', 'auditor', 'admin', 'receptionist']}>
            <AppShell>
              <PageContainer><PrescriptionDetailPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audits"
        element={
          <ProtectedRoute roles={['auditor', 'admin']}>
            <AppShell>
              <AuditQueue />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/analytics"
        element={
          <ProtectedRoute roles={['auditor', 'admin']}>
            <AppShell>
              <AnalyticsDashboard />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/users"
        element={
          <ProtectedRoute roles={['admin']}>
            <AppShell>
              <PageContainer><UserManagement /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/billing"
        element={
          <ProtectedRoute roles={['billing', 'admin', 'receptionist']}>
            <AppShell>
              <PageContainer><BillingPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/beds"
        element={
          <ProtectedRoute roles={['admin', 'nurse']}>
            <AppShell>
              <PageContainer><BedManagement /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/consultation-rooms"
        element={
          <ProtectedRoute roles={['admin', 'nurse', 'receptionist']}>
            <AppShell>
              <PageContainer><ConsultationRoomManagement /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/consultation"
        element={
          <ProtectedRoute roles={['doctor']}>
            <AppShell>
              <ConsultationRoom />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/visits"
        element={
          <ProtectedRoute roles={['receptionist', 'doctor', 'nurse', 'admin', 'billing']}>
            <AppShell>
              <PageContainer><VisitManagement /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/visits/:id"
        element={
          <ProtectedRoute roles={['receptionist', 'doctor', 'nurse', 'admin', 'auditor', 'billing']}>
            <AppShell>
              <PageContainer><VisitDetailPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/pharmacy"
        element={
          <ProtectedRoute roles={['pharmacist', 'admin']}>
            <AppShell>
              <PharmacyQueuePage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/triage"
        element={
          <ProtectedRoute roles={['nurse']}>
            <AppShell>
              <TriageQueuePage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/visits/:id/triage"
        element={
          <ProtectedRoute roles={['nurse']}>
            <AppShell>
              <TriagePage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/visits/:id/journey"
        element={
          <ProtectedRoute roles={['receptionist', 'doctor', 'nurse', 'admin', 'auditor', 'pharmacist', 'billing']}>
            <AppShell>
              <PatientJourneyPage />
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sla-config"
        element={
          <ProtectedRoute roles={['admin', 'auditor']}>
            <AppShell>
              <PageContainer><SLAConfigPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/system-status"
        element={
          <ProtectedRoute roles={['admin']}>
            <AppShell>
              <PageContainer><SystemStatusPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppShell>
              <PageContainer><SettingsPage /></PageContainer>
            </AppShell>
          </ProtectedRoute>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <WebSocketProvider>
            <Toaster
              position="bottom-right"
              richColors
              toastOptions={{ duration: 4000 }}
            />
            <AppRoutes />
          </WebSocketProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
