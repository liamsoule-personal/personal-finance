import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { usePlaidLink } from 'react-plaid-link'
import { api } from '../lib/api'

export default function Onboarding({ onConnected }) {
  const [linkToken, setLinkToken] = useState(null)
  const [loading, setLoading] = useState(false)
  const [fetchingToken, setFetchingToken] = useState(true)
  const [error, setError] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    setFetchingToken(true)
    api.post('/plaid/link-token', {})
      .then(data => setLinkToken(data.link_token))
      .catch(e => {
        console.error(e)
        setError('Failed to initialize Plaid. Please try again.')
      })
      .finally(() => setFetchingToken(false))
  }, [])

  const onSuccess = useCallback(async (public_token) => {
    setLoading(true)
    setError(null)
    try {
      await api.post('/plaid/exchange-token', { public_token })
      onConnected && onConnected()
      navigate('/')
    } catch (e) {
      console.error(e)
      setError('Failed to connect account. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [navigate, onConnected])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit: () => {}
  })

  const features = [
    'Automatic transaction categorization',
    'Weekly spending breakdowns and charts',
    'Smart exclusions for transfers & payments'
  ]

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F4F5F7',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24
    }}>
      <div style={{
        background: '#fff',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        padding: '48px 40px',
        width: '100%',
        maxWidth: 480
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
          fontSize: 22
        }}>
          📒
        </div>

        <h1 style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1B2B6B',
          marginBottom: 8
        }}>
          Weekly Ledger
        </h1>

        <p style={{
          fontSize: 15,
          color: '#6B7280',
          lineHeight: 1.6,
          marginBottom: 32
        }}>
          Connect your bank account securely via Plaid to get a clear weekly view of your spending — automatically categorized and organized.
        </p>

        {/* Features */}
        <div style={{ marginBottom: 32 }}>
          {features.map((feature, i) => (
            <div key={i} style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 12
            }}>
              <div style={{
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: '#EFF6FF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <span style={{ color: '#1B2B6B', fontSize: 12, fontWeight: 700 }}>✓</span>
              </div>
              <span style={{ fontSize: 14, color: '#374151' }}>{feature}</span>
            </div>
          ))}
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2',
            border: '1px solid #FECACA',
            borderRadius: 8,
            padding: '10px 14px',
            marginBottom: 16,
            fontSize: 13,
            color: '#DC2626'
          }}>
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={() => open()}
          disabled={!ready || loading || fetchingToken}
          style={{
            width: '100%',
            padding: '14px 20px',
            fontSize: 15,
            fontWeight: 600,
            borderRadius: 10
          }}
        >
          {loading ? 'Connecting...' : fetchingToken ? 'Initializing...' : 'Connect Chase Account'}
        </button>

        <div style={{
          marginTop: 20,
          textAlign: 'center',
          fontSize: 12,
          color: '#9CA3AF',
          lineHeight: 1.5
        }}>
          Your credentials are never stored by Weekly Ledger.
          <br />Powered by <span style={{ fontWeight: 600, color: '#6B7280' }}>Plaid</span> — bank-level 256-bit encryption.
        </div>
      </div>
    </div>
  )
}
