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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" />} />
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
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
