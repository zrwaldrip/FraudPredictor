import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

function cx(...classes: Array<string | false | undefined | null>) {
  return classes.filter(Boolean).join(' ')
}

export function AppLayout() {
  const auth = useAuth()
  const navigate = useNavigate()

  return (
    <div className="appShell">
      <header className="appHeader">
        <div className="brand" role="banner">
          Fraud Classifier
        </div>
        <nav className="nav">
          <NavLink
            to="/purchase/new"
            className={({ isActive }) => cx('navLink', isActive && 'navLinkActive')}
          >
            Create purchase
          </NavLink>
          <NavLink
            to="/admin/purchases"
            className={({ isActive }) => cx('navLink', isActive && 'navLinkActive')}
          >
            Admin: purchases
          </NavLink>
        </nav>
        <div className="authArea">
          {auth.state.kind === 'admin' ? (
            <>
              <span className="pill">Admin</span>
              <button
                className="button secondary"
                onClick={() => {
                  auth.logout()
                  navigate('/purchase/new')
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <NavLink className="button secondary" to="/login">
              Admin login
            </NavLink>
          )}
        </div>
      </header>
      <main className="appMain">
        <Outlet />
      </main>
      <footer className="appFooter">
        <span>Frontend-only demo (local persistence).</span>
      </footer>
    </div>
  )
}

