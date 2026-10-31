import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
import EarshotDiagram from '../components/EarshotDiagram'
import { GoogleIcon } from '../components/Icons'
import Logo from '../components/Logo'
import { api } from '../lib/api'
import { useAuthStore } from '../store/auth.store'

export default function AuthPage() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const submitting = useAuthStore((s) => s.submitting)
  const login = useAuthStore((s) => s.login)
  const register = useAuthStore((s) => s.register)
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle)

  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '' })
  const isSignup = mode === 'signup'
  // The server says whether Google sign-in is configured; don't offer a button that can't work.
  const [googleEnabled, setGoogleEnabled] = useState(false)
  useEffect(() => {
    api<{ google: boolean }>('/auth/providers')
      .then((p) => setGoogleEnabled(p.google))
      .catch(() => setGoogleEnabled(false))
  }, [])

  // Google errors come back as /auth?error=...
  useEffect(() => {
    const error = params.get('error')
    if (error) {
      toast.error(error)
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  async function onSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    try {
      if (isSignup) await register(form)
      else await login(form.email, form.password)
      toast.success(isSignup ? 'Account created' : 'Welcome back')
      navigate('/home', { replace: true })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  async function onGoogle() {
    try {
      await signInWithGoogle()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <div className="auth">
      <aside className="auth-art" aria-hidden="false">
        <Logo />
        <EarshotDiagram />
        <div className="auth-copy">
          <h2>Walk over to a conversation.</h2>
          <p>Rooms you can move around in. Stand close to someone and you hear them clearly; step away and they fade, like in a real room.</p>
        </div>
      </aside>

      <main className="auth-main">
        <div className="auth-card">
          <span className="auth-mobile-logo">
            <Logo />
          </span>

          <div>
            <h1>{isSignup ? 'Create your account' : 'Welcome back'}</h1>
            <p className="sub">{isSignup ? 'Pick a name, then walk into a room.' : 'Log in to jump back into your rooms.'}</p>
          </div>

          <div className="tabs" role="tablist" aria-label="Log in or sign up">
            <button type="button" role="tab" className="tab" aria-selected={!isSignup} onClick={() => setMode('login')}>
              Log in
            </button>
            <button type="button" role="tab" className="tab" aria-selected={isSignup} onClick={() => setMode('signup')}>
              Sign up
            </button>
          </div>

          {googleEnabled && (
            <>
              <button type="button" className="btn btn-outline btn-lg btn-block" onClick={onGoogle}>
                <GoogleIcon />
                Continue with Google
              </button>
              <div className="divider">or use your email</div>
            </>
          )}

          <form onSubmit={onSubmit} className="form">
            {isSignup && (
              <div className="row">
                <label className="field">
                  Name
                  <input value={form.name} onChange={set('name')} required maxLength={50} autoComplete="name" />
                </label>
                <label className="field">
                  Username
                  <input value={form.username} onChange={set('username')} required maxLength={20} autoComplete="username" />
                </label>
              </div>
            )}
            <label className="field">
              Email
              <input type="email" value={form.email} onChange={set('email')} required autoComplete="email" placeholder="you@example.com" />
            </label>
            <label className="field">
              Password
              <input
                type="password"
                value={form.password}
                onChange={set('password')}
                required
                autoComplete={isSignup ? 'new-password' : 'current-password'}
              />
            </label>
            <button type="submit" className="btn btn-lg btn-block" disabled={submitting}>
              {submitting ? 'Please wait…' : isSignup ? 'Create account' : 'Log in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}
