import type { PropsWithChildren } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext'

export function RequireAdmin(props: PropsWithChildren) {
  const auth = useAuth()
  const location = useLocation()

  if (auth.state.kind !== 'admin') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <>{props.children}</>
}

