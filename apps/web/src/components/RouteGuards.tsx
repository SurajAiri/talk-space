import { Navigate, Outlet, useLocation } from 'react-router'
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

/**
 * Use inside ProtectedRoute. People who have not answered the onboarding questions yet are sent
 * there first, and brought back to the page they were heading for once they are done.
 */
export function OnboardedRoute() {
  const user = useAuthStore((s) => s.user)
  const { pathname, search, state } = useLocation()

  if (user && !user.onboardedAt) {
    return <Navigate to="/onboarding" replace state={{ from: { pathname, search, state } }} />
  }
  return <Outlet />
}

/** The onboarding page is only for people who still have it to do. */
export function NotOnboardedRoute() {
  const user = useAuthStore((s) => s.user)
  return user?.onboardedAt ? <Navigate to="/home" replace /> : <Outlet />
}
