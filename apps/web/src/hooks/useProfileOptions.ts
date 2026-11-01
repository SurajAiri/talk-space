import { useCallback, useEffect, useState } from 'react'
import { loadProfileOptions, type ProfileOptions } from '../lib/profile'

interface State {
  options: ProfileOptions | null
  failed: boolean
}

/** The profile form options, loaded once. `retry` tries again after a failure (offline, server restarting). */
export function useProfileOptions(): State & { retry: () => void } {
  const [state, setState] = useState<State>({ options: null, failed: false })
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    loadProfileOptions()
      .then((options) => !cancelled && setState({ options, failed: false }))
      .catch(() => !cancelled && setState({ options: null, failed: true }))
    return () => {
      cancelled = true
    }
  }, [attempt])

  const retry = useCallback(() => {
    setState({ options: null, failed: false })
    setAttempt((n) => n + 1)
  }, [])

  return { ...state, retry }
}
