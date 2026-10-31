import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import Avatar from '../components/Avatar'
import { ChevronLeftIcon, LogOutIcon } from '../components/Icons'
import { useAuthStore } from '../store/auth.store'

const list = (items: string[]) => (items.length > 0 ? items.join(', ') : '—')

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const logoutEverywhere = useAuthStore((s) => s.logoutEverywhere)

  if (!user) return null

  function onLogout() {
    logout()
    toast.success('Logged out')
    navigate('/auth', { replace: true })
  }

  async function onLogoutEverywhere() {
    try {
      await logoutEverywhere()
      toast.success('Logged out on all devices')
      navigate('/auth', { replace: true })
    } catch {
      toast.error('Could not log out everywhere. Try again.')
    }
  }

  const sections: { title: string; rows: [string, string][] }[] = [
    {
      title: 'Account',
      rows: [
        ['Name', user.name],
        ['Username', `@${user.username}`],
        ['Email', user.email],
        ['Joined', new Date(user.createdAt).toLocaleDateString()],
      ],
    },
    {
      title: 'About you',
      rows: [
        ['Bio', user.bio || '—'],
        ['Speaking languages', list(user.spokenLanguages)],
        ['Interests', list(user.interests)],
        ['Good with', list(user.skills)],
      ],
    },
    {
      title: 'Standing',
      rows: [
        ['Reputation', String(user.reputationScore)],
        ['Strikes', String(user.strikes)],
        ['Status', user.status],
      ],
    },
  ]

  return (
    <div className="app">
      <AppHeader />
      <main className="page">
        <div className="profile">
          <Link to="/home" className="btn btn-ghost btn-small back-link">
            <ChevronLeftIcon size={16} />
            Back to rooms
          </Link>

          <div className="profile-head">
            <Avatar name={user.name} size={64} />
            <div>
              <h1>{user.name}</h1>
              <p>@{user.username}</p>
            </div>
          </div>

          {sections.map((sec) => (
            <section className="profile-section" key={sec.title}>
              <h2>{sec.title}</h2>
              <dl className="info">
                {sec.rows.map(([label, value]) => (
                  <div key={label}>
                    <dt>{label}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}

          <div className="profile-actions">
            <button type="button" className="btn btn-outline" onClick={onLogout}>
              <LogOutIcon size={17} />
              Log out
            </button>
            <button type="button" className="btn btn-ghost btn-quiet-danger" onClick={() => void onLogoutEverywhere()}>
              Log out on all devices
            </button>
          </div>
        </div>
      </main>
    </div>
  )
}
