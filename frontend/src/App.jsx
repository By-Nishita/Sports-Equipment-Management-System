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
import ForgotPassword from './pages/ForgotPassword';
import SetPassword from './pages/SetPassword';
import AdminStudents from './pages/AdminStudents';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/first-time" element={<ForgotPassword firstTime />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route element={<ProtectedRoute><AppShell /></ProtectedRoute>}>
          <Route path="/dashboard" element={<Dashboard />} />
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
        <Route path="/admin/students" element={<RoleRoute roles={['admin']}><AdminStudents /></RoleRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
