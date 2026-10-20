import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import AuthPage from './pages/AuthPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import HomePage from './pages/HomePage'
import { useAuthStore } from './store/auth.store'

export default function App() {
  const loadUser = useAuthStore((s) => s.loadUser)

  useEffect(() => {
    // skip on the Google callback page, which sets the token itself
    if (!window.location.pathname.startsWith('/auth/callback')) void loadUser()
  }, [loadUser])

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/auth/callback" element={<GoogleCallbackPage />} />
        <Route element={<PublicOnlyRoute />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>
        <Route element={<ProtectedRoute />}>
          <Route path="/home" element={<HomePage />} />
        </Route>
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  )
}
