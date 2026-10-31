import { Navigate, Outlet } from 'react-router'
import { useAuthStore } from '../store/auth.store'
import { LogoMark } from './Logo'

function Splash() {
  return (
    <div className="center-screen" role="status" aria-label="Loading">
      <div className="splash">
        <LogoMark size={44} />
      </div>
    </div>
  )
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
