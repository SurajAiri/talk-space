import type { ReactNode } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth.store'
import { LogOutIcon } from './Icons'
import Logo from './Logo'

/**
 * Backdrop shared by every "first run" screen (the privacy consent, each state of onboarding): night
 * sky, the room grid, and voice rings spreading outwards. Always offers "Log out", so nobody is
 * ever stuck on a screen they don't want to complete.
 */
export default function OnboardingBackdrop({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const logout = useAuthStore((s) => s.logout)

  function onLogout() {
    logout()
    toast.success('Logged out')
    navigate('/auth', { replace: true })
  }

  return (
    <div className="onb">
      <div className="onb-rings" aria-hidden="true">
        <span className="onb-ring" />
        <span className="onb-ring" />
        <span className="onb-ring" />
      </div>
      <header className="onb-top">
        <Logo />
        <button type="button" className="btn btn-ghost btn-small onb-logout" onClick={onLogout}>
          <LogOutIcon size={16} />
          Log out
        </button>
      </header>
      {children}
    </div>
  )
}
