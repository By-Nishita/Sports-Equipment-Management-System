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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Navigate to="/login" />} />

        {/* Login ke baad ke saare pages ek hi AppShell (sidebar + top bar) ke andar.
            Naya page jodna ho to bas yahan ek <Route> aur AppShell.jsx ke NAV mein ek item. */}
        <Route
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/scan" element={<Scan />} />
          {/* key alag hai taaki dono pages ek doosre ka data yaad na rakhein */}
          <Route path="/my-use" element={<MySessions key="active" activeOnly />} />
          <Route path="/history" element={<MySessions key="history" />} />
          <Route path="/report-damage" element={<ReportDamage />} />
          <Route
            path="/admin/damage"
            element={
              <RoleRoute roles={['staff', 'admin']}>
                <DamageReviews />
              </RoleRoute>
            }
          />
          <Route path="/change-password" element={<ChangePassword />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
