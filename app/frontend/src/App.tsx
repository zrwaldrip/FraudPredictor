import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { LoginPage } from './pages/LoginPage'
import { NewPurchasePage } from './pages/NewPurchasePage'
import { AdminPurchasesPage } from './pages/AdminPurchasesPage'
import { RequireAdmin } from './auth/RequireAdmin'

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<Navigate to="/purchase/new" replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/purchase/new" element={<NewPurchasePage />} />
        <Route
          path="/admin/purchases"
          element={
            <RequireAdmin>
              <AdminPurchasesPage />
            </RequireAdmin>
          }
        />
        <Route path="*" element={<Navigate to="/purchase/new" replace />} />
      </Route>
    </Routes>
  )
}
