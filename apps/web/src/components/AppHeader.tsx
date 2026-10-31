import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth.store'
import Avatar from './Avatar'
import { LogOutIcon } from './Icons'
import Logo from './Logo'

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
      <Link to="/home" className="brand" aria-label="Talk Space home">
        <Logo />
      </Link>
      <nav className="topbar-nav" aria-label="Account">
        {user && (
          <Link to="/profile" className="profile-link" aria-label={`Your profile, @${user.username}`}>
            <Avatar name={user.name} size={30} />
            <span className="profile-name">@{user.username}</span>
          </Link>
        )}
        <button type="button" className="btn btn-ghost btn-small" onClick={onLogout}>
          <LogOutIcon size={16} />
          Log out
        </button>
      </nav>
    </header>
  )
}
