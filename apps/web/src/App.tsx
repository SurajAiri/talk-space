import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router'
import { Toaster } from 'sonner'
import { ProtectedRoute, PublicOnlyRoute } from './components/RouteGuards'
import AuthPage from './pages/AuthPage'
import GoogleCallbackPage from './pages/GoogleCallbackPage'
import LobbyPage from './pages/LobbyPage'
import ProfilePage from './pages/ProfilePage'
import RoomPage from './pages/RoomPage'
import { useAuthStore } from './store/auth.store'

// Dev-only map editor. `import.meta.env.DEV` is a build-time constant, so production bundles
// contain neither this route nor the editor code.
const MapEditorPage = import.meta.env.DEV ? lazy(() => import('./pages/dev/MapEditorPage')) : null

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
          <Route path="/home" element={<LobbyPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/room/:roomId" element={<RoomPage />} />
        </Route>
        {MapEditorPage && (
          <Route
            path="/dev/maps"
            element={
              <Suspense fallback={null}>
                <MapEditorPage />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  )
}
