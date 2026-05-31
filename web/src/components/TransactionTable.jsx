import { useState, useEffect, useCallback } from 'react'
import ContextMenu from './ContextMenu'
import { CATEGORY_LABELS, getDetailedLabel, getPrimaryFromDetailed } from '../lib/categories'

const AUTO_EXCLUDED_LABELS = {
  transfer_zelle: 'Auto: Zelle',
  transfer_internal: 'Auto: Transfer',
  cc_payment: 'Auto: CC Payment',
  income: 'Auto: Income',
  refund: 'Auto: Refund',
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function formatAmount(amount) {
  return '$' + Math.abs(amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function SortIcon({ dir }) {
  if (!dir) return <span style={{ color: '#D1D5DB', fontSize: 10, marginLeft: 4 }}>↕</span>
  return <span style={{ color: '#1B2B6B', fontSize: 10, marginLeft: 4 }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function TransactionTable({
  transactions = [],
  showExcluded = false,
  onReclassify,
  updateTransaction,
  categoryFilter
}) {
  const [search, setSearch] = useState('')
  const [sortCol, setSortCol] = useState('date')
  const [sortDir, setSortDir] = useState('desc')
  const [contextMenu, setContextMenu] = useState(null) // { x, y, txn }
  const [hoveredRow, setHoveredRow] = useState(null)

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir(col === 'date' ? 'desc' : 'asc')
    }
  }

  // Close context menu on scroll
  useEffect(() => {
    const handler = () => setContextMenu(null)
    window.addEventListener('scroll', handler, true)
    return () => window.removeEventListener('scroll', handler, true)
  }, [])

  const openContextMenu = useCallback((e, txn) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY, txn })
  }, [])

  // Filter
  let visible = transactions.filter(t => {
    if (!showExcluded && !t.is_included) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      if (!t.description?.toLowerCase().includes(q)) return false
    }
    if (categoryFilter) {
      const primary = t.user_primary_category || t.plaid_primary_category ||
        getPrimaryFromDetailed(t.user_detailed_category || t.plaid_detailed_category)
      if (primary !== categoryFilter) return false
    }
    return true
  })

  // Sort
  visible = [...visible].sort((a, b) => {
    let av, bv
    if (sortCol === 'date') { av = a.date; bv = b.date }
    else if (sortCol === 'description') { av = a.description?.toLowerCase(); bv = b.description?.toLowerCase() }
    else if (sortCol === 'amount') { av = Math.abs(a.spend_amount); bv = Math.abs(b.spend_amount) }
    else if (sortCol === 'category') {
      av = (CATEGORY_LABELS[getPrimaryFromDetailed(a.user_detailed_category || a.plaid_detailed_category)] || '').toLowerCase()
      bv = (CATEGORY_LABELS[getPrimaryFromDetailed(b.user_detailed_category || b.plaid_detailed_category)] || '').toLowerCase()
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const getContextMenuItems = (txn) => {
    const items = [
      {
        label: 'Reclassify category',
        action: () => onReclassify && onReclassify(txn)
      },
      { separator: true }
    ]

    if (!txn.user_excluded && txn.is_included) {
      items.push({
        label: 'Exclude this transaction',
        action: () => updateTransaction && updateTransaction(txn.id, { user_excluded: true })
      })
    }

    if (txn.user_excluded) {
      items.push({
        label: 'Un-exclude',
        action: () => updateTransaction && updateTransaction(txn.id, { user_excluded: false })
      })
    }

    if (txn.auto_excluded_reason && !txn.user_included) {
      items.push({
        label: 'Include anyway',
        action: () => updateTransaction && updateTransaction(txn.id, { user_included: true })
      })
    }

    if (txn.user_included) {
      items.push({
        label: 'Remove manual include',
        action: () => updateTransaction && updateTransaction(txn.id, { user_included: false })
      })
    }

    return items
  }

  const thStyle = {
    padding: '10px 16px',
    textAlign: 'left',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color: '#9CA3AF',
    borderBottom: '1px solid #F3F4F6',
    whiteSpace: 'nowrap',
    cursor: 'pointer',
    userSelect: 'none',
    background: '#fff'
  }

  const ColHeader = ({ col, label, style = {} }) => (
    <th style={{ ...thStyle, ...style }} onClick={() => handleSort(col)}>
      {label}
      <SortIcon dir={sortCol === col ? sortDir : null} />
    </th>
  )

  return (
    <div>
      {/* Search bar */}
      <div style={{ marginBottom: 16 }}>
        <input
          type="search"
          placeholder="Search transactions..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 320 }}
        />
      </div>

      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
        overflow: 'hidden'
      }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <ColHeader col="date" label="Date" style={{ paddingLeft: 20 }} />
                <ColHeader col="description" label="Description" />
                <ColHeader col="category" label="Category" />
                <ColHeader col="amount" label="Amount" style={{ textAlign: 'right' }} />
                <th style={{ ...thStyle, width: 110, cursor: 'default' }}>Status</th>
                <th style={{ ...thStyle, width: 48, cursor: 'default' }}></th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '40px 20px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                    No transactions
                  </td>
                </tr>
              ) : (
                visible.map((txn, idx) => {
                  const isExcluded = !txn.is_included
                  const primary = getPrimaryFromDetailed(txn.user_detailed_category || txn.plaid_detailed_category)
                  const detailedLabel = getDetailedLabel(txn.user_detailed_category || txn.plaid_detailed_category)
                  const isHovered = hoveredRow === txn.id

                  return (
                    <tr
                      key={txn.id}
                      onContextMenu={(e) => openContextMenu(e, txn)}
                      onMouseEnter={() => setHoveredRow(txn.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{
                        opacity: isExcluded ? 0.45 : 1,
                        background: isHovered ? '#FAFAFA' : '#fff',
                        borderTop: idx > 0 ? '1px solid #F9FAFB' : 'none',
                        transition: 'background 0.1s',
                        position: 'relative',
                        cursor: 'default'
                      }}
                    >
                      {/* Date */}
                      <td style={{ padding: '12px 16px 12px 20px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {formatDate(txn.date)}
                      </td>

                      {/* Description + chips */}
                      <td style={{ padding: '12px 16px', maxWidth: 280 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span style={{
                            fontSize: 13, color: '#1A1A2E', fontWeight: 500,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            maxWidth: 200
                          }}>
                            {txn.description}
                          </span>
                          {txn.pending && <span className="chip chip-pending">Pending</span>}
                          {txn.user_detailed_category && <span className="chip chip-reclassified">Reclassified</span>}
                        </div>
                        {txn.merchant_name && txn.merchant_name !== txn.description && (
                          <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>
                            {txn.merchant_name}
                          </div>
                        )}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '12px 16px', fontSize: 13, color: '#6B7280', whiteSpace: 'nowrap' }}>
                        {primary ? (
                          <span>
                            <span style={{ color: '#9CA3AF', fontSize: 11 }}>{CATEGORY_LABELS[primary]}</span>
                            {' · '}
                            <span style={{ color: '#6B7280' }}>{detailedLabel}</span>
                          </span>
                        ) : (
                          <span style={{ color: '#D1D5DB', fontStyle: 'italic' }}>Uncategorized</span>
                        )}
                      </td>

                      {/* Amount */}
                      <td style={{
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: 13,
                        fontWeight: 600,
                        color: txn.spend_amount < 0 ? '#059669' : '#1A1A2E',
                        whiteSpace: 'nowrap'
                      }}>
                        {txn.spend_amount != null ? formatAmount(txn.spend_amount) : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>
                        {isExcluded ? (
                          <span className="chip chip-excluded">
                            {txn.auto_excluded_reason
                              ? (AUTO_EXCLUDED_LABELS[txn.auto_excluded_reason] || 'Auto: Excluded')
                              : 'Excluded'
                            }
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: '#065F46',
                            background: '#D1FAE5',
                            borderRadius: 999,
                            padding: '2px 8px',
                          }}>
                            ● Counted
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '12px 8px', width: 40, textAlign: 'center' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            openContextMenu(e, txn)
                          }}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: '#9CA3AF',
                            fontSize: 18,
                            lineHeight: 1,
                            padding: '4px 6px',
                            borderRadius: 6,
                            opacity: isHovered ? 1 : 0,
                            transition: 'opacity 0.15s, background 0.1s',
                            fontFamily: 'Inter, sans-serif'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = '#F3F4F6'; e.currentTarget.style.color = '#1A1A2E' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = '#9CA3AF' }}
                        >
                          ⋮
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={getContextMenuItems(contextMenu.txn)}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
