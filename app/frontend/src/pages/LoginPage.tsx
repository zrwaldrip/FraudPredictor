import { useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ADMIN_EMAIL, useAuth } from '../auth/AuthContext'

export function LoginPage() {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = useMemo(() => {
    const state = location.state as { from?: string } | null
    return state?.from ?? '/admin/purchases'
  }, [location.state])

  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const ok = auth.loginAsAdmin(email, password)
    if (!ok) {
      setError('Invalid admin credentials.')
      return
    }
    navigate(from, { replace: true })
  }

  return (
    <div className="page">
      <div className="card">
        <h1>Admin login</h1>
        <p className="muted">
          This is frontend-only (hardcoded) auth for now.
        </p>

        <form className="form" onSubmit={onSubmit}>
          <label className="field">
            <span>Email</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              placeholder="admin@example.com"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              placeholder="••••••••"
            />
          </label>

          {error ? <div className="error">{error}</div> : null}

          <div className="row">
            <button className="button primary" type="submit">
              Log in
            </button>
            <button
              className="button secondary"
              type="button"
              onClick={() => navigate('/purchase/new')}
            >
              Cancel
            </button>
          </div>
        </form>

        <details className="hint">
          <summary>Admin credentials</summary>
          <div className="hintBody">
            <div>
              <span className="muted">Email:</span> {ADMIN_EMAIL}
            </div>
            <div>
              <span className="muted">Password:</span> admin
            </div>
          </div>
        </details>
      </div>
    </div>
  )
}

