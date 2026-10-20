import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../store/auth.store'

function Splash() {
  return <div className="center-screen">Loading…</div>
}

/** Only logged-in users get through; others go to /auth. */
export function ProtectedRoute() {
  const initializing = useAuthStore((s) => s.initializing)
  const user = useAuthStore((s) => s.user)

  if (initializing) return <Splash />
  return user ? <Outlet /> : <Navigate to="/auth" replace />
}

/** Logged-in users skip the auth page and go to /home. */
export function PublicOnlyRoute() {
  const initializing = useAuthStore((s) => s.initializing)
  const user = useAuthStore((s) => s.user)

  if (initializing) return <Splash />
  return user ? <Navigate to="/home" replace /> : <Outlet />
}
