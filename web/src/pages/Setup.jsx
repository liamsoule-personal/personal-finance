import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'

const STEP_CREDENTIALS = 'credentials'
const STEP_SHORTCUT = 'shortcut'

function StepIndicator({ current }) {
  const steps = [
    { key: STEP_CREDENTIALS, label: 'API Keys' },
    { key: STEP_SHORTCUT,    label: 'Quick Access' },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 32 }}>
      {steps.map((s, i) => {
        const done = steps.findIndex(x => x.key === current) > i
        const active = s.key === current
        return (
          <div key={s.key} style={{ display: 'flex', alignItems: 'center', flex: i < steps.length - 1 ? 1 : 'none' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: done ? '#059669' : active ? '#1B2B6B' : '#E5E7EB',
                color: done || active ? '#fff' : '#9CA3AF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, fontWeight: 700, flexShrink: 0,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: active ? '#1B2B6B' : '#9CA3AF', whiteSpace: 'nowrap' }}>
                {s.label}
              </span>
            </div>
            {i < steps.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? '#059669' : '#E5E7EB', margin: '0 8px', marginBottom: 20 }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function GuideStep({ number, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 14 }}>
      <div style={{
        width: 22, height: 22, borderRadius: '50%', background: '#1B2B6B',
        color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 1,
      }}>
        {number}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6B7280', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  )
}

function CredentialsStep({ onDone, onConfigured }) {
  const [clientId, setClientId] = useState('')
  const [secret, setSecret] = useState('')
  const [plaidEnv, setPlaidEnv] = useState('development')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [guideOpen, setGuideOpen] = useState(true)

  const handleSave = async (e) => {
    e.preventDefault()
    if (!clientId.trim() || !secret.trim()) { setError('Both fields are required.'); return }
    setSaving(true); setError(null)
    try {
      await api.post('/setup/credentials', { client_id: clientId.trim(), secret: secret.trim(), plaid_env: plaidEnv })
      onConfigured && onConfigured()
      onDone()
    } catch (e) {
      setError(e?.detail || 'Failed to save. Check your credentials and try again.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 12px', fontSize: 14,
    border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', color: '#111827', background: '#fff',
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <div style={{
          width: 40, height: 40, background: '#1B2B6B', borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>📒</div>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#1B2B6B', margin: 0 }}>Welcome to Weekly Ledger</h1>
      </div>

      <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, marginBottom: 20 }}>
        Weekly Ledger reads your bank transactions through{' '}
        <a href="https://plaid.com" target="_blank" rel="noreferrer" style={{ color: '#1B2B6B', fontWeight: 600 }}>Plaid</a>
        {' '}— a secure financial data service used by thousands of apps. You'll need a free Plaid developer account.
      </p>

      {/* Collapsible setup guide */}
      <div style={{
        border: '1px solid #E5E7EB', borderRadius: 12, marginBottom: 24, overflow: 'hidden',
      }}>
        <button
          type="button"
          onClick={() => setGuideOpen(o => !o)}
          style={{
            width: '100%', padding: '12px 16px', background: guideOpen ? '#EFF6FF' : '#F9FAFB',
            border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center',
            justifyContent: 'space-between', fontFamily: 'inherit',
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, color: '#1B2B6B' }}>
            How to get your Plaid API keys
          </span>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{guideOpen ? '▲ Hide' : '▼ Show'}</span>
        </button>

        {guideOpen && (
          <div style={{ padding: '16px 16px 8px' }}>
            <GuideStep number={1} title="Create a free Plaid account">
              Visit{' '}
              <a href="https://dashboard.plaid.com/signup" target="_blank" rel="noreferrer"
                style={{ color: '#1B2B6B', fontWeight: 600 }}>dashboard.plaid.com/signup
              </a>
              . Fill in your name, email, and password, then verify your email address.
            </GuideStep>

            <GuideStep number={2} title="Complete the onboarding questions">
              Plaid will ask a few questions about your use case. Select <strong>"Personal use"</strong> or <strong>"Building a personal project"</strong> when asked.
            </GuideStep>

            <GuideStep number={3} title="Find your API keys">
              Once inside the Plaid Dashboard, click <strong>Team Settings</strong> in the left sidebar,
              then click <strong>Keys</strong>. You will see your <strong>client_id</strong> and two secret keys —
              one for Sandbox and one for Development.
            </GuideStep>

            <GuideStep number={4} title="Choose your environment">
              <strong>Sandbox</strong> uses fake test data — no real bank required, free, and great for trying the app.{' '}
              <strong>Development</strong> connects to your actual bank accounts and shows real transactions (up to 100 connections, free).
            </GuideStep>

            <GuideStep number={5} title="Copy and paste your keys below">
              Your <strong>Client ID</strong> is the same for both environments. Your <strong>Secret</strong> changes
              depending on whether you select Sandbox or Development above — copy the matching one from the Keys page.
            </GuideStep>

            <div style={{
              background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: 8,
              padding: '10px 12px', marginBottom: 12, fontSize: 12, color: '#92400E',
            }}>
              <strong>Security note:</strong> Your keys are stored only in a <code>.env</code> file on this machine
              and are sent directly to Plaid — never to any third party.
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleSave}>
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Client ID
          </label>
          <input
            type="text" placeholder="e.g. 5f3a1b2c3d4e5f6a7b8c9d0e"
            value={clientId} onChange={e => setClientId(e.target.value)}
            style={inputStyle} autoComplete="off" spellCheck={false}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Secret
          </label>
          <input
            type="password" placeholder="Your Plaid secret key"
            value={secret} onChange={e => setSecret(e.target.value)}
            style={inputStyle} autoComplete="off"
          />
        </div>

        <div style={{ marginBottom: 22 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
            Environment
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { value: 'sandbox',     label: 'Sandbox',     desc: 'Fake test data — no bank needed' },
              { value: 'development', label: 'Development', desc: 'Real banks — live transactions' },
            ].map(opt => (
              <label key={opt.value} style={{
                flex: 1, border: `2px solid ${plaidEnv === opt.value ? '#1B2B6B' : '#E5E7EB'}`,
                borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                background: plaidEnv === opt.value ? '#EFF6FF' : '#fff',
              }}>
                <input type="radio" name="plaid_env" value={opt.value}
                  checked={plaidEnv === opt.value} onChange={() => setPlaidEnv(opt.value)}
                  style={{ display: 'none' }} />
                <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', marginBottom: 3 }}>{opt.label}</div>
                <div style={{ fontSize: 11, color: '#6B7280', lineHeight: 1.4 }}>{opt.desc}</div>
              </label>
            ))}
          </div>
        </div>

        {error && (
          <div style={{
            background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
            padding: '10px 14px', marginBottom: 14, fontSize: 13, color: '#DC2626',
          }}>
            {error}
          </div>
        )}

        <button type="submit" disabled={saving || !clientId.trim() || !secret.trim()}
          className="btn-primary"
          style={{ width: '100%', padding: '13px 20px', fontSize: 15, fontWeight: 600, borderRadius: 10 }}>
          {saving ? 'Saving...' : 'Save & Continue →'}
        </button>
      </form>

      <p style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: '#9CA3AF' }}>
        Already have an account? Your credentials live in the <code>.env</code> file in the project folder.
      </p>
    </>
  )
}

function ShortcutStep({ onDone }) {
  const [creating, setCreating] = useState(false)
  const [result, setResult] = useState(null) // null | 'created' | 'error'

  const handleCreate = async () => {
    setCreating(true)
    try {
      await api.post('/setup/create-shortcut', {})
      setResult('created')
      localStorage.setItem('shortcut_offered', '1')
    } catch {
      setResult('error')
    } finally {
      setCreating(false)
    }
  }

  const handleSkip = () => {
    localStorage.setItem('shortcut_offered', '1')
    onDone()
  }

  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🖥️</div>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#1B2B6B', marginBottom: 8 }}>
          Add a Desktop Shortcut?
        </h2>
        <p style={{ fontSize: 14, color: '#6B7280', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
          Create a one-click shortcut on your Desktop so you can launch Weekly Ledger anytime without opening a terminal.
        </p>
      </div>

      {result === 'created' && (
        <div style={{
          background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10,
          padding: '14px 18px', marginBottom: 20, textAlign: 'center',
        }}>
          <div style={{ fontSize: 18, marginBottom: 6 }}>✓</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#065F46', marginBottom: 4 }}>
            Shortcut created!
          </div>
          <div style={{ fontSize: 13, color: '#059669' }}>
            Look for <strong>"Personal Finance"</strong> on your Desktop.
          </div>
        </div>
      )}

      {result === 'error' && (
        <div style={{
          background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 10,
          padding: '12px 16px', marginBottom: 20, fontSize: 13, color: '#DC2626', textAlign: 'center',
        }}>
          Could not create shortcut automatically. You can always launch the app by running{' '}
          <code>./launcher.sh</code> in the project folder.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {result !== 'created' && (
          <button onClick={handleCreate} disabled={creating} className="btn-primary"
            style={{ width: '100%', padding: '13px 20px', fontSize: 15, fontWeight: 600, borderRadius: 10 }}>
            {creating ? 'Creating...' : 'Yes, add Desktop shortcut'}
          </button>
        )}
        <button onClick={onDone}
          style={{
            width: '100%', padding: '12px 20px', fontSize: 14, fontWeight: 500, borderRadius: 10,
            background: 'none', border: '1px solid #E5E7EB', cursor: 'pointer',
            color: '#6B7280', fontFamily: 'inherit',
          }}>
          {result === 'created' ? 'Continue to app →' : 'Skip for now'}
        </button>
      </div>
    </>
  )
}

export default function Setup({ onConfigured }) {
  const navigate = useNavigate()
  const shortcutAlreadyOffered = localStorage.getItem('shortcut_offered') === '1'
  const [step, setStep] = useState(STEP_CREDENTIALS)

  const handleCredentialsDone = () => {
    if (shortcutAlreadyOffered) {
      navigate('/onboarding')
    } else {
      setStep(STEP_SHORTCUT)
    }
  }

  const handleShortcutDone = () => {
    navigate('/onboarding')
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F4F5F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.1)',
        padding: '40px 40px', width: '100%', maxWidth: 500,
      }}>
        <StepIndicator current={step} />

        {step === STEP_CREDENTIALS && (
          <CredentialsStep onDone={handleCredentialsDone} onConfigured={onConfigured} />
        )}
        {step === STEP_SHORTCUT && (
          <ShortcutStep onDone={handleShortcutDone} />
        )}
      </div>
    </div>
  )
}
