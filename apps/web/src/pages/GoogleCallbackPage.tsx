import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { toast } from 'sonner'
import { LogoMark } from '../components/Logo'
import { useAuthStore } from '../store/auth.store'

/** The API redirects here with our JWT in the URL fragment: /auth/callback#token=... */
export default function GoogleCallbackPage() {
  const navigate = useNavigate()
  const setToken = useAuthStore((s) => s.setToken)
  // The token is removed from the address bar as soon as it is read, so this must only ever run
  // once. React StrictMode (dev) runs effects twice; the second run would find no token and
  // wrongly report a failure. Refs survive that double run.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    const fail = () => {
      toast.error('Google login failed')
      navigate('/auth', { replace: true })
    }

    const token = new URLSearchParams(window.location.hash.slice(1)).get('token')
    if (!token) return fail()

    // drop the token from the address bar / history
    window.history.replaceState(null, '', window.location.pathname)
    void setToken(token).then(() => {
      // setToken loads the user; no user means the token was rejected (or the API is unreachable)
      if (useAuthStore.getState().user) navigate('/home', { replace: true })
      else fail()
    })
  }, [navigate, setToken])

  return (
    <div className="center-screen" role="status">
      <div className="splash">
        <LogoMark size={44} />
        <p>Signing you in…</p>
      </div>
    </div>
  )
}
