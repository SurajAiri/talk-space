import { useEffect, useState, type SyntheticEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { toast } from 'sonner'
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
    <div className="center-screen">
      <div className="card">
        <h1>{isSignup ? 'Create your account' : 'Log in'}</h1>

        {googleEnabled && (
          <>
            <button type="button" className="btn btn-outline" onClick={onGoogle}>
              Continue with Google
            </button>
            <div className="divider">or</div>
          </>
        )}

        <form onSubmit={onSubmit} className="form">
          {isSignup && (
            <>
              <input placeholder="Name" value={form.name} onChange={set('name')} required maxLength={50} />
              <input placeholder="Username" value={form.username} onChange={set('username')} required maxLength={20} />
            </>
          )}
          <input type="email" placeholder="Email" value={form.email} onChange={set('email')} required />
          <input type="password" placeholder="Password" value={form.password} onChange={set('password')} required />
          <button type="submit" className="btn" disabled={submitting}>
            {submitting ? 'Please wait…' : isSignup ? 'Sign up' : 'Log in'}
          </button>
        </form>

        <p className="muted">
          {isSignup ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className="link" onClick={() => setMode(isSignup ? 'login' : 'signup')}>
            {isSignup ? 'Log in' : 'Sign up'}
          </button>
        </p>
      </div>
    </div>
  )
}
