import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import Layout from './components/Layout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Inventory from './pages/Inventory'
import AddVehicle from './pages/AddVehicle'
import VehicleDetail from './pages/VehicleDetail'
import Expenses from './pages/Expenses'
import Capital from './pages/Capital'
import Settings from './pages/Settings'

function ProtectedRoute({ children, adminOnly = false }) {
  const { user, profile, loading } = useAuth()

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-bg">
      <div className="spinner" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />
  if (adminOnly && profile?.role !== 'admin') return <Navigate to="/" replace />

  return children
}

function AppRoutes() {
  const { user } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />

      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="vehicles/new" element={<AddVehicle />} />
        <Route path="vehicles/:id" element={<VehicleDetail />} />
        <Route path="vehicles/:id/edit" element={<AddVehicle />} />
        <Route path="expenses" element={<ProtectedRoute adminOnly><Expenses /></ProtectedRoute>} />
        <Route path="capital"  element={<ProtectedRoute adminOnly><Capital /></ProtectedRoute>} />
        <Route path="settings" element={<ProtectedRoute adminOnly><Settings /></ProtectedRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}
