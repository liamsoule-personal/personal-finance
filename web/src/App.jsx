import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { api } from './lib/api'
import Dashboard from './pages/Dashboard'
import AllTransactions from './pages/AllTransactions'
import Goals from './pages/Goals'
import Onboarding from './pages/Onboarding'
import Setup from './pages/Setup'

function AppRoutes() {
  const [configured, setConfigured] = useState(null)
  const [hasAccounts, setHasAccounts] = useState(null)

  useEffect(() => {
    api.get('/setup/status')
      .then(data => setConfigured(data.configured))
      .catch(() => setConfigured(false))
  }, [])

  useEffect(() => {
    if (!configured) return
    api.get('/accounts')
      .then(accounts => setHasAccounts(accounts.length > 0))
      .catch(() => setHasAccounts(false))
  }, [configured])

  if (configured === null || (configured && hasAccounts === null)) {
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
        path="/setup"
        element={<Setup onConfigured={() => { setConfigured(true); setHasAccounts(false) }} />}
      />
      <Route
        path="/onboarding"
        element={configured ? <Onboarding onConnected={() => setHasAccounts(true)} /> : <Navigate to="/setup" />}
      />
      <Route
        path="/"
        element={
          !configured ? <Navigate to="/setup" /> :
          !hasAccounts ? <Navigate to="/onboarding" /> :
          <Dashboard />
        }
      />
      <Route
        path="/transactions"
        element={
          !configured ? <Navigate to="/setup" /> :
          !hasAccounts ? <Navigate to="/onboarding" /> :
          <AllTransactions />
        }
      />
      <Route
        path="/goals"
        element={
          !configured ? <Navigate to="/setup" /> :
          !hasAccounts ? <Navigate to="/onboarding" /> :
          <Goals />
        }
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
