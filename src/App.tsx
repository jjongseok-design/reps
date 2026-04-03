import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import WorkoutTabPage from './pages/WorkoutTabPage'
import WorkoutDetailPage from './pages/WorkoutDetailPage'
import HistoryPage from './pages/HistoryPage'
import StatsPage from './pages/StatsPage'
import BottomNav from './components/BottomNav'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) return (
    <div className="min-h-screen bg-dark flex items-center justify-center">
      <p className="text-gray-500">로딩 중...</p>
    </div>
  )

  if (!user) return (
    <Routes>
      <Route path="*" element={<AuthPage />} />
    </Routes>
  )

  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/workout" />} />
        <Route path="/workout" element={<WorkoutTabPage />} />
        <Route path="/workout/:id" element={<WorkoutDetailPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="/stats" element={<StatsPage />} />
        <Route path="*" element={<Navigate to="/workout" />} />
      </Routes>
      <BottomNav />
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  )
}
