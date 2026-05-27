import { useState } from 'react'
import { useWeek } from '../hooks/useWeek'
import { useTransactions } from '../hooks/useTransactions'
import Sidebar from '../components/Sidebar'
import TransactionTable from '../components/TransactionTable'
import ReclassifyModal from '../components/ReclassifyModal'

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
]

function formatDateShort(d) {
  return `${MONTH_SHORT[d.getMonth()]} ${d.getDate()}`
}

export default function AllTransactions() {
  const week = useWeek()
  const { transactions, loading, error, refetch, updateTransaction } = useTransactions(week.weekStartStr)
  const [reclassifyTxn, setReclassifyTxn] = useState(null)

  const includedCount = transactions.filter(t => t.is_included).length
  const excludedCount = transactions.filter(t => !t.is_included).length

  const weekDateRange = `${formatDateShort(week.weekStart)} – ${formatDateShort(week.weekEnd)}, ${week.weekEnd.getFullYear()}`

  const handleSave = () => refetch()

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar {...week} />

      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: 32,
        minWidth: 0
      }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', marginBottom: 6 }}>
            All Transactions
            <span style={{ fontWeight: 400, color: '#6B7280', fontSize: 18, marginLeft: 12 }}>
              — {weekDateRange}
            </span>
          </h1>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#059669' }}>{includedCount}</span> included
            </span>
            <span style={{ fontSize: 13, color: '#6B7280' }}>
              <span style={{ fontWeight: 600, color: '#9CA3AF' }}>{excludedCount}</span> excluded
            </span>
            {!loading && (
              <span style={{ fontSize: 13, color: '#9CA3AF' }}>
                {transactions.length} total
              </span>
            )}
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="card" style={{ textAlign: 'center', padding: 48, color: '#9CA3AF' }}>
            <div style={{ marginBottom: 8 }}>Loading transactions...</div>
            <div style={{ fontSize: 12 }}>Fetching week of {week.weekStartStr}</div>
          </div>
        ) : error ? (
          <div className="card" style={{ textAlign: 'center', padding: 48 }}>
            <div style={{ color: '#DC2626', marginBottom: 12 }}>Failed to load transactions.</div>
            <button
              onClick={refetch}
              className="btn-secondary"
            >
              Retry
            </button>
          </div>
        ) : (
          <TransactionTable
            transactions={transactions}
            showExcluded={true}
            onReclassify={(txn) => setReclassifyTxn(txn)}
            updateTransaction={updateTransaction}
            categoryFilter={null}
          />
        )}
      </main>

      {reclassifyTxn && (
        <ReclassifyModal
          transaction={reclassifyTxn}
          onClose={() => setReclassifyTxn(null)}
          onSave={handleSave}
        />
      )}
    </div>
  )
}
