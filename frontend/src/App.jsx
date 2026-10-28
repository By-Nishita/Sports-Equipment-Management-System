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
import Booking from './pages/Booking';
import MyBookings from './pages/MyBookings';
import RoleRoute from './components/RoleRoute';
import AdminDashboard from './pages/AdminDashboard';
import AdminSettings from './pages/AdminSettings';
import AuditLogPage from './pages/AuditLogPage';
import Catalog from './pages/Catalog';
import AdminTypes from './pages/AdminTypes';
import AdminUnits from './pages/AdminUnits';
import QrPrint from './pages/QrPrint';
import Maintenance from './pages/Maintenance';
import AdminStockAudit from './pages/AdminStockAudit';
import StaffStockCount from './pages/StaffStockCount';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/catalog" element={<Catalog />} />
          <Route path="/admin/types" element={<RoleRoute roles={['admin']}><AdminTypes /></RoleRoute>} />
          <Route path="/admin/units" element={<RoleRoute roles={['admin']}><AdminUnits /></RoleRoute>} />
          <Route path="/admin/qr-print" element={<RoleRoute roles={['admin']}><QrPrint /></RoleRoute>} />
          <Route path="/admin/maintenance" element={<RoleRoute roles={['admin']}><Maintenance /></RoleRoute>} />
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
          <Route path="/scan" element={<Scan />} />
          <Route path="/my-use" element={<MySessions key="active" activeOnly />} />
          <Route path="/history" element={<MySessions key="history" />} />
          <Route path="/book" element={<Booking />} />
          <Route path="/my-bookings" element={<MyBookings />} />
          <Route path="/report-damage" element={<ReportDamage />} />
          <Route path="/admin" element={<RoleRoute roles={['staff', 'admin']}><AdminDashboard /></RoleRoute>} />
          <Route path="/admin/damage" element={<RoleRoute roles={['staff', 'admin']}><DamageReviews /></RoleRoute>} />
          <Route path="/change-password" element={<ChangePassword />} />
        <Route path="/admin/settings" element={<RoleRoute roles={['admin']}><AdminSettings /></RoleRoute>} />
        <Route path="/admin/audit-log" element={<RoleRoute roles={['admin']}><AuditLogPage /></RoleRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;

