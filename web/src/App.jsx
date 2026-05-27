import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from './lib/api'
import Dashboard from './pages/Dashboard'
import AllTransactions from './pages/AllTransactions'
import Onboarding from './pages/Onboarding'

function AppRoutes() {
  const [hasAccounts, setHasAccounts] = useState(null)

  useEffect(() => {
    api.get('/accounts')
      .then(accounts => setHasAccounts(accounts.length > 0))
      .catch(() => setHasAccounts(false))
  }, [])

  if (hasAccounts === null) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: '#6B7280',
        fontSize: 14,
        flexDirection: 'column',
        gap: 12
      }}>
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid #E5E7EB',
          borderTopColor: '#1B2B6B',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite'
        }} />
        <span>Loading Weekly Ledger...</span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/onboarding"
        element={<Onboarding onConnected={() => setHasAccounts(true)} />}
      />
      <Route
        path="/"
        element={hasAccounts ? <Dashboard /> : <Navigate to="/onboarding" />}
      />
      <Route
        path="/transactions"
        element={hasAccounts ? <AllTransactions /> : <Navigate to="/onboarding" />}
      />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}
