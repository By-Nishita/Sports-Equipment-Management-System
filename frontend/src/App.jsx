import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChangePassword from './pages/ChangePassword';
import ProtectedRoute from './components/ProtectedRoute';
import AppShell from './components/AppShell';
import Scan from './pages/Scan';
import ReportDamage from './pages/ReportDamage';
import MySessions from './pages/MySessions';
import DamageReviews from './pages/DamageReviews';
import RoleRoute from './components/RoleRoute';
import AdminDashboard from './pages/AdminDashboard';
import AdminSettings from './pages/AdminSettings';
import AuditLogPage from './pages/AuditLogPage';

// Latest main imports
import ForgotPassword from './pages/ForgotPassword';
import SetPassword from './pages/SetPassword';
import AdminStudents from './pages/AdminStudents';
import ReturnItem from './pages/ReturnItem';
import StaffApprovals from './pages/StaffApprovals';
import PendingReturns from './pages/PendingReturns';
import OverdueList from './pages/OverdueList';
import Profile from './pages/Profile';

// N4 imports
import Catalog from './pages/Catalog';
import AdminTypes from './pages/AdminTypes';
import AdminUnits from './pages/AdminUnits';
import QrPrint from './pages/QrPrint';
import Reports from './pages/Reports';
import Maintenance from './pages/Maintenance';
import AdminStockAudit from './pages/AdminStockAudit';
import StaffStockCount from './pages/StaffStockCount';

function currentRole() {
  try { return JSON.parse(localStorage.getItem('user'))?.role || 'student'; } catch { return 'student'; }
}

// Admin has no student/staff home, so send admin to the admin dashboard.
function HomeRedirect() {
  return currentRole() === 'admin' ? <Navigate to="/admin" replace /> : <Dashboard />;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/set-password" element={<SetPassword />} />

        {/* Protected application routes */}
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard" element={<HomeRedirect />} />

          {/* N4: Equipment inventory */}
          <Route path="/catalog" element={<Catalog />} />
          <Route
            path="/admin/types"
            element={
              <RoleRoute roles={['admin']}>
                <AdminTypes />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/units"
            element={
              <RoleRoute roles={['admin']}>
                <AdminUnits />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <Reports />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/qr-print"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <QrPrint />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/maintenance"
            element={
              <RoleRoute roles={['admin']}>
                <Maintenance />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/stock-audit"
            element={
              <RoleRoute roles={['admin']}>
                <AdminStockAudit />
              </RoleRoute>
            }
          />
          <Route
            path="/staff/stock-count"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <StaffStockCount />
              </RoleRoute>
            }
          />

          {/* Existing issue and return features */}
          <Route path="/scan" element={<Scan />} />
          <Route path="/return" element={<ReturnItem />} />
          <Route
            path="/my-use"
            element={<MySessions key="active" activeOnly />}
          />
          <Route
            path="/history"
            element={<MySessions key="history" />}
          />
          <Route path="/report-damage" element={<ReportDamage />} />

          <Route
            path="/admin"
            element={
              <RoleRoute roles={['admin']}>
                <AdminDashboard />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/damage"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <DamageReviews />
              </RoleRoute>
            }
          />

          {/* Staff desk */}
          <Route
            path="/staff/approvals"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <StaffApprovals />
              </RoleRoute>
            }
          />
          <Route
            path="/staff/returns"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <PendingReturns />
              </RoleRoute>
            }
          />
          <Route
            path="/staff/overdue"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <OverdueList />
              </RoleRoute>
            }
          />

          {/* User profile */}
          <Route path="/profile" element={<Profile />} />
          <Route path="/change-password" element={<ChangePassword />} />

          {/* Existing admin pages */}
          <Route
            path="/admin/settings"
            element={
              <RoleRoute roles={['admin']}>
                <AdminSettings />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/audit-log"
            element={
              <RoleRoute roles={['admin']}>
                <AuditLogPage />
              </RoleRoute>
            }
          />
          <Route
            path="/admin/students"
            element={
              <RoleRoute roles={['admin']}>
                <AdminStudents />
              </RoleRoute>
            }
          />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;