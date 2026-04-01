import { createContext, useContext, useMemo, useState } from 'react'
import type { PropsWithChildren } from 'react'

export const ADMIN_EMAIL = 'admin@example.com'
const ADMIN_PASSWORD = 'admin'
const AUTH_STORAGE_KEY = 'fraud_app_auth_v1'

export type AuthState =
  | { kind: 'anonymous' }
  | { kind: 'admin'; email: string }

type AuthApi = {
  state: AuthState
  loginAsAdmin: (email: string, password: string) => boolean
  logout: () => void
}

const AuthContext = createContext<AuthApi | null>(null)

function loadAuthState(): AuthState {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return { kind: 'anonymous' }
    const parsed = JSON.parse(raw) as AuthState
    if (parsed?.kind === 'admin' && typeof parsed.email === 'string') return parsed
    return { kind: 'anonymous' }
  } catch {
    return { kind: 'anonymous' }
  }
}

function saveAuthState(state: AuthState) {
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(state))
}

export function AuthProvider(props: PropsWithChildren) {
  const [state, setState] = useState<AuthState>(() => loadAuthState())

  const api = useMemo<AuthApi>(() => {
    return {
      state,
      loginAsAdmin(email, password) {
        const ok = email.trim().toLowerCase() === ADMIN_EMAIL && password === ADMIN_PASSWORD
        if (!ok) return false
        const next: AuthState = { kind: 'admin', email: ADMIN_EMAIL }
        setState(next)
        saveAuthState(next)
        return true
      },
      logout() {
        const next: AuthState = { kind: 'anonymous' }
        setState(next)
        saveAuthState(next)
      },
    }
  }, [state])

  return <AuthContext.Provider value={api}>{props.children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}

