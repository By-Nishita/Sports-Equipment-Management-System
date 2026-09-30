import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChangePassword from './pages/ChangePassword';
<<<<<<< HEAD
import Reservations from './pages/Reservations';

=======
import ProtectedRoute from './components/ProtectedRoute';
import Scan from './pages/Scan';
>>>>>>> origin/main

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
<<<<<<< HEAD
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/reservations" element={<Reservations />} />
=======
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
>>>>>>> origin/main
        <Route path="/" element={<Navigate to="/login" />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
  path="/scan"
  element={
    <ProtectedRoute>
      <Scan />
    </ProtectedRoute>
  }
/>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
