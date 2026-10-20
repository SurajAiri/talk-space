import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth.store'

export default function AppHeader() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  function onLogout() {
    logout()
    toast.success('Logged out')
    navigate('/auth', { replace: true })
  }

  return (
    <header className="topbar">
      <Link to="/home" className="brand">
        Talk Space
      </Link>
      <nav className="topbar-nav">
        {user && <Link to="/profile">@{user.username}</Link>}
        <button type="button" className="link" onClick={onLogout}>
          Log out
        </button>
      </nav>
    </header>
  )
}
