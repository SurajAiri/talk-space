import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import { useAuthStore } from '../store/auth.store'

const list = (items: string[]) => (items.length > 0 ? items.join(', ') : '—')

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)

  if (!user) return null

  function onLogout() {
    logout()
    toast.success('Logged out')
    navigate('/auth', { replace: true })
  }

  const rows: [string, string][] = [
    ['Name', user.name],
    ['Username', `@${user.username}`],
    ['Email', user.email],
    ['Bio', user.bio || '—'],
    ['Speaking languages', list(user.spokenLanguages)],
    ['Interests', list(user.interests)],
    ['Good with', list(user.skills)],
    ['Joined', new Date(user.createdAt).toLocaleDateString()],
    ['Reputation', String(user.reputationScore)],
    ['Strikes', String(user.strikes)],
    ['Status', user.status],
  ]

  return (
    <div className="center-screen">
      <div className="card">
        <h1>Profile</h1>
        <dl className="info">
          {rows.map(([label, value]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
        </dl>
        <Link to="/home" className="btn btn-outline center">Back to rooms</Link>
        <button className="btn" onClick={onLogout}>Log out</button>
      </div>
    </div>
  )
}
