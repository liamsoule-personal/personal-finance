import { useState, useEffect, useRef, useMemo } from 'react'
import { ALL_DETAILED, CATEGORY_LABELS, getDetailedLabel, getPrimaryFromDetailed } from '../lib/categories'
import { api } from '../lib/api'

export default function ReclassifyModal({ transaction, onClose, onSave }) {
  const [step, setStep] = useState(1)
  const [query, setQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [scope, setScope] = useState('transaction') // 'transaction' | 'rule'
  const [saving, setSaving] = useState(false)
  const searchRef = useRef()

  useEffect(() => {
    if (step === 1 && searchRef.current) {
      setTimeout(() => searchRef.current?.focus(), 50)
    }
  }, [step])

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  const filtered = useMemo(() => {
    if (!query.trim()) return ALL_DETAILED
    const q = query.toLowerCase()
    return ALL_DETAILED.filter(d => d.label.toLowerCase().includes(q))
  }, [query])

  // Group by primary
  const grouped = useMemo(() => {
    const map = {}
    filtered.forEach(d => {
      if (!map[d.primary]) map[d.primary] = []
      map[d.primary].push(d)
    })
    return map
  }, [filtered])

  const merchantPattern = transaction.merchant_name
    || transaction.description?.slice(0, 25)
    || ''

  const handleSave = async () => {
    setSaving(true)
    try {
      if (scope === 'transaction') {
        await api.patch(`/transactions/${transaction.id}`, {
          user_detailed_category: selectedCategory
        })
      } else {
        await api.post('/categorization-rules', {
          pattern: merchantPattern,
          pattern_type: 'contains',
          target_detailed_category: selectedCategory,
          apply_historical: true
        })
      }
      onSave && onSave()
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0, 0, 0, 0.4)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16
      }}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 16,
        boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        width: '100%',
        maxWidth: 520,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        maxHeight: '90vh'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px 16px',
          borderBottom: '1px solid #F3F4F6',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              {step === 2 && (
                <button
                  onClick={() => setStep(1)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#6B7280', fontSize: 13, padding: '0 0 6px 0',
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  ← Back
                </button>
              )}
              <div style={{ fontSize: 15, fontWeight: 600, color: '#1A1A2E' }}>
                {step === 1 ? 'Reclassify Transaction' : 'Apply Changes'}
              </div>
              <div style={{
                fontSize: 12, color: '#6B7280', marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                maxWidth: 380
              }}>
                {transaction.description}
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', fontSize: 20, lineHeight: 1,
                padding: 4, borderRadius: 6,
                fontFamily: 'Inter, sans-serif'
              }}
            >
              ×
            </button>
          </div>
        </div>

        {step === 1 ? (
          <>
            {/* Current category */}
            {transaction.user_detailed_category || transaction.detailed_category ? (
              <div style={{ padding: '12px 24px 0', flexShrink: 0 }}>
                <div style={{
                  background: '#F0F3FF',
                  borderRadius: 8,
                  padding: '8px 12px',
                  fontSize: 12,
                  color: '#1B2B6B'
                }}>
                  <span style={{ color: '#6B7280' }}>Current: </span>
                  <span style={{ fontWeight: 600 }}>
                    {getDetailedLabel(transaction.user_detailed_category || transaction.detailed_category)}
                  </span>
                </div>
              </div>
            ) : null}

            {/* Search */}
            <div style={{ padding: '12px 24px 8px', flexShrink: 0 }}>
              <input
                ref={searchRef}
                type="search"
                placeholder="Search categories..."
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            {/* Category list */}
            <div style={{ overflowY: 'auto', flex: 1, maxHeight: 360, padding: '0 24px' }}>
              {Object.entries(grouped).length === 0 ? (
                <div style={{ padding: '24px 0', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  No categories match your search
                </div>
              ) : (
                Object.entries(grouped).map(([primary, items]) => (
                  <div key={primary} style={{ marginBottom: 8 }}>
                    <div style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      color: '#9CA3AF',
                      padding: '8px 0 4px',
                      position: 'sticky',
                      top: 0,
                      background: '#fff'
                    }}>
                      {CATEGORY_LABELS[primary] || primary}
                    </div>
                    {items.map(d => (
                      <button
                        key={d.code}
                        onClick={() => setSelectedCategory(d.code)}
                        style={{
                          display: 'block',
                          width: '100%',
                          textAlign: 'left',
                          padding: '8px 10px',
                          border: selectedCategory === d.code ? '1.5px solid #1B2B6B' : '1.5px solid transparent',
                          borderRadius: 8,
                          background: selectedCategory === d.code ? '#F0F3FF' : 'transparent',
                          cursor: 'pointer',
                          fontSize: 13,
                          color: selectedCategory === d.code ? '#1B2B6B' : '#1A1A2E',
                          fontWeight: selectedCategory === d.code ? 600 : 400,
                          fontFamily: 'Inter, sans-serif',
                          marginBottom: 2,
                          transition: 'all 0.1s'
                        }}
                        onMouseEnter={e => {
                          if (selectedCategory !== d.code) {
                            e.currentTarget.style.background = '#F9FAFB'
                          }
                        }}
                        onMouseLeave={e => {
                          if (selectedCategory !== d.code) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              flexShrink: 0
            }}>
              <button className="btn-secondary" onClick={onClose}>Cancel</button>
              <button
                className="btn-primary"
                disabled={!selectedCategory}
                onClick={() => setStep(2)}
              >
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 */}
            <div style={{ padding: '20px 24px', flex: 1, overflowY: 'auto' }}>
              {/* Selected category display */}
              <div style={{
                background: '#F0F3FF',
                borderRadius: 10,
                padding: '12px 16px',
                marginBottom: 20
              }}>
                <div style={{ fontSize: 11, color: '#6B7280', marginBottom: 4 }}>New category</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#1B2B6B' }}>
                  {getDetailedLabel(selectedCategory)}
                </div>
              </div>

              <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E', marginBottom: 12 }}>
                How should this apply?
              </div>

              {/* Option 1 */}
              <div
                onClick={() => setScope('transaction')}
                style={{
                  border: scope === 'transaction' ? '2px solid #1B2B6B' : '2px solid #E5E7EB',
                  borderRadius: 10,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  marginBottom: 10,
                  background: scope === 'transaction' ? '#F0F3FF' : '#fff',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: scope === 'transaction' ? '5px solid #1B2B6B' : '2px solid #D1D5DB',
                    flexShrink: 0, transition: 'all 0.15s'
                  }} />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E' }}>
                      This transaction only
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      Only update this single transaction
                    </div>
                  </div>
                </div>
              </div>

              {/* Option 2 */}
              <div
                onClick={() => setScope('rule')}
                style={{
                  border: scope === 'rule' ? '2px solid #1B2B6B' : '2px solid #E5E7EB',
                  borderRadius: 10,
                  padding: '14px 16px',
                  cursor: 'pointer',
                  background: scope === 'rule' ? '#F0F3FF' : '#fff',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%',
                    border: scope === 'rule' ? '5px solid #1B2B6B' : '2px solid #D1D5DB',
                    flexShrink: 0, transition: 'all 0.15s'
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#1A1A2E' }}>
                      Create a rule for all matching transactions
                    </div>
                    <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>
                      Also applies to past and future transactions
                    </div>
                    {merchantPattern && (
                      <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 12, color: '#6B7280' }}>Pattern:</span>
                        <span style={{
                          background: '#F3F4F6', borderRadius: 6,
                          padding: '2px 8px', fontSize: 12, fontFamily: 'monospace',
                          color: '#1A1A2E', fontWeight: 500
                        }}>
                          {merchantPattern}
                        </span>
                        <span className="chip chip-auto">contains</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px',
              borderTop: '1px solid #F3F4F6',
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              flexShrink: 0
            }}>
              <button className="btn-secondary" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
