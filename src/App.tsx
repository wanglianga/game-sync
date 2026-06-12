import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/auth'
import Layout from '@/components/Layout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import SyncWall from '@/pages/SyncWall'
import CardDetail from '@/pages/CardDetail'
import NewCard from '@/pages/NewCard'
import Assets from '@/pages/Assets'
import Webhooks from '@/pages/Webhooks'
import Reports from '@/pages/Reports'
import Notifications from '@/pages/Notifications'

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" />
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route
          path="/"
          element={
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          }
        >
          <Route index element={<SyncWall />} />
          <Route path="card/new" element={<NewCard />} />
          <Route path="card/:id" element={<CardDetail />} />
          <Route path="assets" element={<Assets />} />
          <Route path="webhooks" element={<Webhooks />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
      </Routes>
    </Router>
  )
}
