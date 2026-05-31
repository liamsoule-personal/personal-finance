import { useState, useEffect, useCallback } from 'react'
import { useWeek } from '../hooks/useWeek'
import { api } from '../lib/api'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/categories'
import Sidebar from '../components/Sidebar'

const SPENDABLE_CATEGORIES = Object.entries(CATEGORY_LABELS)
  .filter(([key]) => !['TRANSFER_IN', 'TRANSFER_OUT', 'INCOME'].includes(key))
  .sort((a, b) => a[1].localeCompare(b[1]))

function formatMoney(n) {
  if (n == null) return '—'
  return '$' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function ProgressBar({ pct, status }) {
  const capped = Math.min(pct, 100)
  const color = status === 'on_track' ? '#059669' : '#DC2626'
  const bg = status === 'on_track' ? '#D1FAE5' : '#FEE2E2'
  return (
    <div style={{ height: 6, borderRadius: 999, background: bg, overflow: 'hidden', margin: '8px 0' }}>
      <div style={{
        height: '100%', width: `${capped}%`, borderRadius: 999,
        background: color, transition: 'width 0.4s ease',
      }} />
    </div>
  )
}

function StatusBadge({ status }) {
  const on = status === 'on_track'
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '3px 9px',
      background: on ? '#D1FAE5' : '#FEE2E2',
      color: on ? '#065F46' : '#991B1B',
    }}>
      {on ? '● On Track' : '● Off Track'}
    </span>
  )
}

function GoalCard({ goal, onEdit, onDelete }) {
  const limit = goal.weekly_limit
  const actual = goal.actual_spend ?? 0
  const projected = goal.projected_spend ?? 0
  const pct = goal.percent_used ?? 0
  const catColor = goal.category ? (CATEGORY_COLORS[goal.category] || '#9CA3AF') : '#1B2B6B'
  const catLabel = goal.category ? (CATEGORY_LABELS[goal.category] || goal.category) : null

  return (
    <div style={{
      background: '#fff', borderRadius: 14, boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
      padding: '20px 20px 16px', display: 'flex', flexDirection: 'column', gap: 0,
      borderTop: `4px solid ${catColor}`,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginBottom: 3 }}>{goal.name}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em',
              color: '#9CA3AF', background: '#F3F4F6', borderRadius: 4, padding: '2px 6px',
            }}>
              {goal.type === 'weekly' ? 'Weekly' : 'Category'}
            </span>
            {catLabel && (
              <span style={{ fontSize: 11, color: '#6B7280' }}>{catLabel}</span>
            )}
          </div>
        </div>
        <StatusBadge status={goal.status} />
      </div>

      {/* Progress bar */}
      <ProgressBar pct={pct} status={goal.status} />

      {/* Amounts row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
        <div>
          <span style={{ fontSize: 20, fontWeight: 700, color: '#1A1A2E' }}>{formatMoney(actual)}</span>
          <span style={{ fontSize: 13, color: '#9CA3AF' }}> / {formatMoney(limit)}</span>
        </div>
        <div style={{ fontSize: 12, color: '#6B7280', textAlign: 'right' }}>
          <span style={{ fontWeight: 600 }}>{pct.toFixed(0)}%</span> used
        </div>
      </div>

      {/* Projection */}
      <div style={{
        background: '#F9FAFB', borderRadius: 8, padding: '8px 12px',
        display: 'flex', justifyContent: 'space-between', marginBottom: 14, fontSize: 12,
      }}>
        <span style={{ color: '#6B7280' }}>
          Projected week total
        </span>
        <span style={{
          fontWeight: 700,
          color: goal.status === 'on_track' ? '#059669' : '#DC2626',
        }}>
          {formatMoney(projected)}
        </span>
      </div>

      <div style={{ fontSize: 11, color: '#9CA3AF', marginBottom: 12 }}>
        Based on {goal.days_elapsed} of 7 days elapsed
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, borderTop: '1px solid #F3F4F6', paddingTop: 12 }}>
        <button onClick={() => onEdit(goal)}
          style={{
            flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
            background: 'none', border: '1px solid #E5E7EB', borderRadius: 8,
            cursor: 'pointer', color: '#1B2B6B', fontFamily: 'inherit',
          }}>
          Edit
        </button>
        <button onClick={() => onDelete(goal.id)}
          style={{
            flex: 1, padding: '7px 0', fontSize: 12, fontWeight: 600,
            background: 'none', border: '1px solid #FECACA', borderRadius: 8,
            cursor: 'pointer', color: '#DC2626', fontFamily: 'inherit',
          }}>
          Delete
        </button>
      </div>
    </div>
  )
}

function GoalModal({ goal, onClose, onSaved }) {
  const isEdit = !!goal
  const [name, setName] = useState(goal?.name || '')
  const [type, setType] = useState(goal?.type || 'weekly')
  const [category, setCategory] = useState(goal?.category || '')
  const [limit, setLimit] = useState(goal?.weekly_limit?.toString() || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const parsed = parseFloat(limit)
    if (!name.trim()) { setError('Name is required.'); return }
    if (isNaN(parsed) || parsed <= 0) { setError('Enter a valid spending limit greater than $0.'); return }
    if (type === 'category' && !category) { setError('Select a category.'); return }

    setSaving(true); setError(null)
    try {
      if (isEdit) {
        await api.patch(`/goals/${goal.id}`, { name: name.trim(), weekly_limit: parsed })
      } else {
        await api.post('/goals', {
          name: name.trim(), type,
          category: type === 'category' ? category : null,
          weekly_limit: parsed,
        })
      }
      onSaved()
    } catch (e) {
      setError(e?.detail || 'Failed to save goal.')
    } finally {
      setSaving(false)
    }
  }

  const inputStyle = {
    width: '100%', padding: '9px 12px', fontSize: 14,
    border: '1px solid #E5E7EB', borderRadius: 8, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit', color: '#111827',
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div style={{
        background: '#fff', borderRadius: 16, padding: '32px 28px',
        width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.2)',
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A1A2E', marginBottom: 20 }}>
          {isEdit ? 'Edit Goal' : 'New Spending Goal'}
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Goal name
            </label>
            <input type="text" placeholder='e.g. "Keep food under $200"'
              value={name} onChange={e => setName(e.target.value)} style={inputStyle} />
          </div>

          {!isEdit && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
                Goal type
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { value: 'weekly',   label: 'Total weekly spend', desc: 'Cap all spending this week' },
                  { value: 'category', label: 'Category spend',     desc: 'Cap one spending category' },
                ].map(opt => (
                  <label key={opt.value} style={{
                    flex: 1, border: `2px solid ${type === opt.value ? '#1B2B6B' : '#E5E7EB'}`,
                    borderRadius: 10, padding: '10px 12px', cursor: 'pointer',
                    background: type === opt.value ? '#EFF6FF' : '#fff',
                  }}>
                    <input type="radio" name="goal_type" value={opt.value}
                      checked={type === opt.value} onChange={() => setType(opt.value)}
                      style={{ display: 'none' }} />
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: '#6B7280' }}>{opt.desc}</div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {!isEdit && type === 'category' && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
                Category
              </label>
              <select value={category} onChange={e => setCategory(e.target.value)}
                style={{ ...inputStyle, background: '#fff' }}>
                <option value="">Select a category…</option>
                {SPENDABLE_CATEGORIES.map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
          )}

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
              Weekly spending limit
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                color: '#9CA3AF', fontSize: 14, pointerEvents: 'none',
              }}>$</span>
              <input type="number" min="1" step="1" placeholder="0"
                value={limit} onChange={e => setLimit(e.target.value)}
                style={{ ...inputStyle, paddingLeft: 24 }} />
            </div>
          </div>

          {error && (
            <div style={{
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8,
              padding: '9px 12px', marginBottom: 14, fontSize: 13, color: '#DC2626',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{
                flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 500,
                background: 'none', border: '1px solid #E5E7EB', borderRadius: 10,
                cursor: 'pointer', color: '#6B7280', fontFamily: 'inherit',
              }}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-primary"
              style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: 600, borderRadius: 10 }}>
              {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create goal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function Goals() {
  const week = useWeek()
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState(null) // null | 'new' | goal-object (edit)

  const fetchGoals = useCallback(() => {
    setLoading(true)
    api.get(`/goals?week_start=${week.weekStartStr}`)
      .then(setGoals)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [week.weekStartStr])

  useEffect(() => { fetchGoals() }, [fetchGoals])

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this goal?')) return
    await api.delete(`/goals/${id}`)
    fetchGoals()
  }

  const onTrack = goals.filter(g => g.status === 'on_track').length
  const offTrack = goals.filter(g => g.status === 'off_track').length

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar {...week} />

      <main style={{ flex: 1, overflow: 'auto', padding: 32, minWidth: 0 }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>Goals</h1>
            <div style={{ fontSize: 13, color: '#6B7280' }}>
              Week of {week.weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
              {' – '}
              {week.weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          <button onClick={() => setModal('new')} className="btn-primary"
            style={{ padding: '9px 18px', fontSize: 14, fontWeight: 600, borderRadius: 10 }}>
            + Add Goal
          </button>
        </div>

        {/* Summary strip */}
        {goals.length > 0 && (
          <div style={{ display: 'flex', gap: 14, marginBottom: 24 }}>
            {[
              { label: 'Goals',     value: goals.length,  color: '#1B2B6B', bg: '#EFF6FF' },
              { label: 'On Track',  value: onTrack,       color: '#065F46', bg: '#D1FAE5' },
              { label: 'Off Track', value: offTrack,      color: '#991B1B', bg: '#FEE2E2' },
            ].map(s => (
              <div key={s.label} style={{
                background: s.bg, borderRadius: 12, padding: '12px 20px',
                display: 'flex', flexDirection: 'column', gap: 2,
              }}>
                <span style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: s.color, opacity: 0.8 }}>{s.label}</span>
              </div>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#9CA3AF', fontSize: 14 }}>
            Loading goals…
          </div>
        ) : goals.length === 0 ? (
          <div style={{
            background: '#fff', borderRadius: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            padding: '60px 40px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎯</div>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: '#1A1A2E', marginBottom: 8 }}>
              No goals yet
            </h3>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24, maxWidth: 320, margin: '0 auto 24px' }}>
              Set weekly or category spending limits and the app will track whether you're on pace to stay under them.
            </p>
            <button onClick={() => setModal('new')} className="btn-primary"
              style={{ padding: '11px 24px', fontSize: 14, fontWeight: 600, borderRadius: 10 }}>
              Add your first goal
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {goals.map(g => (
              <GoalCard key={g.id} goal={g}
                onEdit={g => setModal(g)}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </main>

      {modal && (
        <GoalModal
          goal={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); fetchGoals() }}
        />
      )}
    </div>
  )
}
