import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

export default function Setup({ onConfigured }) {
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [plaidEnv, setPlaidEnv] = useState('development')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  const handleSave = async (e) => {
    e.preventDefault()
    if (!clientId.trim() || !secret.trim()) {
      setError('Both Client ID and Secret are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await api.post('/setup/credentials', {
        client_id: clientId.trim(),
        secret: secret.trim(),
        plaid_env: plaidEnv,
      })
      onConfigured && onConfigured()
      navigate('/onboarding')
    } catch (e) {
      setError(e?.detail || 'Failed to save credentials. Please check and try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #E5E7EB',
    borderRadius: 8,
    outline: 'none',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    color: '#111827',
    background: '#fff',
  }

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    color: '#374151',
    marginBottom: 6,
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F5F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        padding: '48px 40px',
        width: '100%',
        maxWidth: 480,
      }}>
        {/* Logo mark */}
        <div style={{
          width: 48,
          height: 48,
          background: '#1B2B6B',
          borderRadius: 12,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 24,
          fontSize: 22,
        }}>
          📒
        </div>

        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1B2B6B', marginBottom: 8 }}>
          Welcome to Weekly Ledger
        </h1>

        <p style={{ fontSize: 15, color: '#6B7280', lineHeight: 1.6, marginBottom: 28 }}>
          This app uses{' '}
          <a
            href="https://plaid.com"
            target="_blank"
            rel="noreferrer"
            style={{ color: '#1B2B6B', fontWeight: 600 }}
          >
            Plaid
          </a>
          {' '}to securely read your bank transactions. You'll need a free Plaid developer account to get started.
        </p>

        {/* Step 1 */}
        <div style={{
          background: '#EFF6FF',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 28,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2B6B', marginBottom: 6 }}>
            STEP 1 — Create a free Plaid account
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>
            Sign up at Plaid, then go to{' '}
            <strong>Team Settings → Keys</strong>{' '}
            to find your Client ID and Secret.
          </p>
          <a
            href="https://dashboard.plaid.com/signup"
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '8px 16px',
              background: '#1B2B6B',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Sign up for Plaid →
          </a>
        </div>

        {/* Step 2 */}
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1B2B6B', marginBottom: 16 }}>
          STEP 2 — Enter your API keys
        </div>

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Client ID</label>
            <input
              type="text"
              placeholder="e.g. 5f3a1b2c3d4e5f6a7b8c9d0e"
              value={clientId}
              onChange={e => setClientId(e.target.value)}
              style={inputStyle}
              autoComplete="off"
              spellCheck={false}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Secret</label>
            <input
              type="password"
              placeholder="Your Plaid secret key"
              value={secret}
              onChange={e => setSecret(e.target.value)}
              style={inputStyle}
              autoComplete="off"
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Environment</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                { value: 'sandbox', label: 'Sandbox', desc: 'Fake test data — free, no real bank needed' },
                { value: 'development', label: 'Development', desc: 'Real banks — up to 100 live connections' },
              ].map(opt => (
                <label
                  key={opt.value}
                  style={{
                    flex: 1,
                    border: `2px solid ${plaidEnv === opt.value ? '#1B2B6B' : '#E5E7EB'}`,
                    borderRadius: 10,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    background: plaidEnv === opt.value ? '#EFF6FF' : '#fff',
                    transition: 'all 0.15s',
                  }}
                >
                  <input
                    type="radio"
                    name="plaid_env"
                    value={opt.value}
                    checked={plaidEnv === opt.value}
                    onChange={() => setPlaidEnv(opt.value)}
                    style={{ display: 'none' }}
                  />
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 3 }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>
                    {opt.desc}
                  </div>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              borderRadius: 8,
              padding: '10px 14px',
              marginBottom: 16,
              fontSize: 13,
              color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !clientId.trim() || !secret.trim()}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px 20px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 10,
            }}
          >
            {saving ? 'Saving...' : 'Save & Continue'}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: '#9CA3AF', lineHeight: 1.5 }}>
          Your credentials are stored locally in a <code>.env</code> file on this machine only.
        </p>
      </div>
    </div>
  )
}
