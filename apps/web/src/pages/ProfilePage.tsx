import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { toast } from 'sonner'
import AppHeader from '../components/AppHeader'
import Avatar from '../components/Avatar'
import {
  AtSignIcon,
  CalendarIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  GlobeIcon,
  HeartIcon,
  KeyIcon,
  LogOutIcon,
  MailIcon,
  PencilIcon,
  PlusIcon,
  ShieldIcon,
  SparklesIcon,
  StarIcon,
  UserIcon,
  ZapIcon,
} from '../components/Icons'
import ChangePasswordDialog from '../components/profile/ChangePasswordDialog'
import EditProfileDialog from '../components/profile/EditProfileDialog'
import { useProfileOptions } from '../hooks/useProfileOptions'
import { PRIVACY_POLICY_PATH } from '../lib/legal'
import { genderLabel, languageNames } from '../lib/profile'
import { useAuthStore } from '../store/auth.store'

const number = new Intl.NumberFormat(undefined, { maximumFractionDigits: 1 })

/** The ring motif from the logo (a voice, where it is heard clearly, where it fades), drawn behind the avatar. */
function BannerRings() {
  return (
    <svg className="phero-rings" viewBox="0 0 800 140" preserveAspectRatio="xMinYMax slice" aria-hidden="true" focusable="false">
      <g fill="none" stroke="#fff">
        <circle cx="92" cy="150" r="74" strokeOpacity=".34" strokeWidth="2" />
        <circle cx="92" cy="150" r="118" strokeOpacity=".3" strokeWidth="2" strokeDasharray="2 9" strokeLinecap="round" />
        <circle cx="92" cy="150" r="180" strokeOpacity=".13" strokeWidth="1.5" />
        <circle cx="92" cy="150" r="250" strokeOpacity=".12" strokeWidth="1.5" strokeDasharray="2 10" strokeLinecap="round" />
        <circle cx="92" cy="150" r="330" strokeOpacity=".07" strokeWidth="1.5" />
      </g>
    </svg>
  )
}

function Chips({ items, kind, empty, onAdd }: { items: string[]; kind: 'language' | 'interest' | 'skill'; empty: string; onAdd: () => void }) {
  if (items.length === 0) {
    return (
      <button type="button" className="pempty" onClick={onAdd}>
        <PlusIcon size={15} />
        {empty}
      </button>
    )
  }
  return (
    <ul className="pchips">
      {items.map((item) => (
        <li key={item} className={`pchip pchip-${kind}`}>
          {item}
        </li>
      ))}
    </ul>
  )
}

function Block({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="pblock">
      <h3 className="pblock-title">
        {icon}
        {title}
      </h3>
      {children}
    </div>
  )
}

function Fact({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="pfact">
      <dt>
        {icon}
        {label}
      </dt>
      <dd>{children}</dd>
    </div>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const logoutEverywhere = useAuthStore((s) => s.logoutEverywhere)
  const { options, retry } = useProfileOptions()
  const [dialog, setDialog] = useState<'edit' | 'password' | null>(null)

  if (!user) return null

  // the form needs the option lists; if they haven't arrived (slow or failed), ask again instead of opening an empty form
  function openEdit() {
    if (options) return setDialog('edit')
    retry()
    toast.message('Still loading. Try again in a moment.')
  }

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

  const joined = new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
  const gender = genderLabel(options, user.gender)
  const acceptedOn = user.privacyPolicyAcceptedAt
    ? new Date(user.privacyPolicyAcceptedAt).toLocaleDateString(undefined, { dateStyle: 'medium' })
    : null

  return (
    <div className="app">
      <AppHeader />
      <main className="page">
        <div className="profile">
          <Link to="/home" className="btn btn-ghost btn-small back-link">
            <ChevronLeftIcon size={16} />
            Back to rooms
          </Link>

          <section className="phero" aria-label="Your profile">
            <div className="phero-banner">
              <BannerRings />
            </div>
            <div className="phero-body">
              <div className="phero-avatar">
                <Avatar name={user.name} size={96} />
              </div>
              <div className="phero-id">
                <h1>{user.name}</h1>
                <p className="phero-meta">
                  <span>@{user.username}</span>
                  <span className="phero-dot" aria-hidden="true" />
                  <span className="phero-joined">
                    <CalendarIcon size={14} /> Joined {joined}
                  </span>
                </p>
              </div>
              <button type="button" className="btn phero-edit" onClick={openEdit}>
                <PencilIcon size={16} />
                Edit profile
              </button>
            </div>
          </section>

          <div className="pgrid">
            <div className="pcol">
              <section className="psec">
                <header className="psec-head">
                  <h2>About me</h2>
                  <button type="button" className="btn btn-ghost btn-small" onClick={openEdit}>
                    <PencilIcon size={14} />
                    Edit
                  </button>
                </header>
                <div className="psec-body">
                  {user.bio ? (
                    <p className="pbio">{user.bio}</p>
                  ) : (
                    <button type="button" className="pempty pempty-wide" onClick={openEdit}>
                      <SparklesIcon size={16} />
                      Add a short bio so people know what to talk to you about
                    </button>
                  )}

                  <Block icon={<GlobeIcon size={16} />} title="Speaks">
                    <Chips items={languageNames(options, user.spokenLanguages)} kind="language" empty="Add languages" onAdd={openEdit} />
                  </Block>
                  <Block icon={<HeartIcon size={16} />} title="Into">
                    <Chips items={user.interests} kind="interest" empty="Add interests" onAdd={openEdit} />
                  </Block>
                  <Block icon={<ZapIcon size={16} />} title="Good at">
                    <Chips items={user.skills} kind="skill" empty="Add what you’re good at" onAdd={openEdit} />
                  </Block>
                </div>
              </section>
            </div>

            <aside className="pcol">
              <section className="psec">
                <header className="psec-head">
                  <h2>Standing</h2>
                </header>
                <div className="pstats">
                  <div className="pstat">
                    <StarIcon size={18} />
                    <strong>{number.format(user.reputationScore)}</strong>
                    <span>Reputation</span>
                  </div>
                  <div className="pstat">
                    <ShieldIcon size={18} />
                    <strong>{user.strikes}</strong>
                    <span>{user.strikes === 1 ? 'Strike' : 'Strikes'}</span>
                  </div>
                  <div className="pstat">
                    <CheckCircleIcon size={18} />
                    <strong className="pstat-status">{user.status}</strong>
                    <span>Status</span>
                  </div>
                </div>
              </section>

              <section className="psec">
                <header className="psec-head">
                  <h2>Account</h2>
                </header>
                <dl className="pfacts">
                  <Fact icon={<UserIcon size={16} />} label="Name">
                    {user.name}
                  </Fact>
                  <Fact icon={<AtSignIcon size={16} />} label="Username">
                    @{user.username}
                  </Fact>
                  <Fact icon={<MailIcon size={16} />} label="Email">
                    <span className="pfact-break">{user.email}</span>
                  </Fact>
                  <Fact icon={<UserIcon size={16} />} label="Gender">
                    {gender ?? <span className="muted-inline">Not set</span>}
                  </Fact>
                  <Fact icon={<ShieldIcon size={16} />} label="Privacy Policy">
                    {acceptedOn ? `Accepted ${acceptedOn}` : <span className="muted-inline">Not accepted</span>}
                    {' · '}
                    <Link to={PRIVACY_POLICY_PATH}>Read</Link>
                  </Fact>
                </dl>
              </section>

              <section className="psec">
                <header className="psec-head">
                  <h2>Security</h2>
                </header>
                <div className="psec-body">
                  {user.hasPassword ? (
                    <div className="psecurity">
                      <span className="psecurity-icon">
                        <KeyIcon size={18} />
                      </span>
                      <div>
                        <strong>Password</strong>
                        <p>Change it any time. Other devices will be logged out.</p>
                      </div>
                      <button type="button" className="btn btn-outline btn-small" onClick={() => setDialog('password')}>
                        Change
                      </button>
                    </div>
                  ) : (
                    <div className="psecurity">
                      <span className="psecurity-icon">
                        <KeyIcon size={18} />
                      </span>
                      <div>
                        <strong>Signed in with Google</strong>
                        <p>There’s no password to manage. Google keeps this account secure.</p>
                      </div>
                    </div>
                  )}
                  <div className="psession">
                    <button type="button" className="btn btn-outline" onClick={onLogout}>
                      <LogOutIcon size={17} />
                      Log out
                    </button>
                    <button type="button" className="btn btn-ghost btn-quiet-danger" onClick={() => void onLogoutEverywhere()}>
                      Log out on all devices
                    </button>
                  </div>
                </div>
              </section>
            </aside>
          </div>
        </div>
      </main>

      {dialog === 'edit' && options && <EditProfileDialog user={user} options={options} onClose={() => setDialog(null)} />}
      {dialog === 'password' && <ChangePasswordDialog onClose={() => setDialog(null)} />}
    </div>
  )
}
