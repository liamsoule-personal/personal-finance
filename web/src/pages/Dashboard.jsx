import { useState, useEffect, useCallback } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { useWeek } from '../hooks/useWeek'
import { useTransactions } from '../hooks/useTransactions'
import { api } from '../lib/api'
import { CATEGORY_LABELS } from '../lib/categories'
import Sidebar from '../components/Sidebar'
import KpiCard from '../components/KpiCard'
import CategoryDonut from '../components/CategoryDonut'
import DailyBar from '../components/DailyBar'
import TransactionTable from '../components/TransactionTable'
import ReclassifyModal from '../components/ReclassifyModal'

function RelinkBanner({ account }) {
  const [linkToken, setLinkToken] = useState(null)
  const [fetchingToken, setFetchingToken] = useState(false)

  const fetchToken = useCallback(() => {
    setFetchingToken(true)
    api.post('/plaid/link-token', { account_id: account.id })
      .then(d => setLinkToken(d.link_token))
      .catch(console.error)
      .finally(() => setFetchingToken(false))
  }, [account.access_token])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: async (public_token) => {
      try {
        await api.post('/plaid/exchange-token', { public_token })
        window.location.reload()
      } catch (e) {
        console.error(e)
      }
    }
  })

  const handleReconnect = () => {
    if (linkToken && ready) {
      open()
    } else {
      fetchToken()
    }
  }

  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  return (
    <div style={{
      background: '#FFFBEB',
      border: '1px solid #FCD34D',
      borderRadius: 10,
      padding: '12px 16px',
      marginBottom: 20,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16
    }}>
      <div style={{ fontSize: 13, color: '#92400E', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span>⚠</span>
        <span>
          <strong>{account.institution_name || 'Your bank'}</strong> connection expired — reconnect to continue syncing
        </span>
      </div>
      <button
        onClick={handleReconnect}
        disabled={fetchingToken}
        style={{
          background: '#92400E',
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          padding: '6px 14px',
          fontSize: 12,
          fontWeight: 600,
          cursor: fetchingToken ? 'not-allowed' : 'pointer',
          fontFamily: 'Inter, sans-serif',
          whiteSpace: 'nowrap',
          opacity: fetchingToken ? 0.7 : 1,
          transition: 'opacity 0.15s'
        }}
      >
        {fetchingToken ? 'Loading...' : 'Reconnect'}
      </button>
    </div>
  )
}

export default function Dashboard() {
  const week = useWeek()
  const { transactions, loading: txnLoading, error: txnError, refetch, updateTransaction } = useTransactions(week.weekStartStr)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [accounts, setAccounts] = useState([])
  const [selectedCategory, setSelectedCategory] = useState(null)
  const [reclassifyTxn, setReclassifyTxn] = useState(null)

  // Fetch analytics
  useEffect(() => {
    setAnalyticsLoading(true)
    api.get(`/analytics/week?week_start=${week.weekStartStr}`)
      .then(data => setAnalytics(data))
      .catch(console.error)
      .finally(() => setAnalyticsLoading(false))
  }, [week.weekStartStr])

  // Fetch accounts for relink banner
  useEffect(() => {
    api.get('/accounts')
      .then(setAccounts)
      .catch(console.error)
  }, [])

  const relinkAccounts = accounts.filter(a => a.item_status === 'requires_relink')

  const handleCategoryClick = (category) => {
    setSelectedCategory(prev => prev === category ? null : category)
  }

  const handleReclassify = (txn) => setReclassifyTxn(txn)

  const handleSave = () => {
    refetch()
    setAnalyticsLoading(true)
    api.get(`/analytics/week?week_start=${week.weekStartStr}`)
      .then(data => setAnalytics(data))
      .catch(console.error)
      .finally(() => setAnalyticsLoading(false))
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Sidebar {...week} />

      <main style={{
        flex: 1,
        overflow: 'auto',
        padding: 32,
        minWidth: 0
      }}>
        {/* Relink banners */}
        {relinkAccounts.map(a => (
          <RelinkBanner key={a.id} account={a} />
        ))}

        {/* Page header */}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1A1A2E', marginBottom: 4 }}>
            Dashboard
          </h1>
          <div style={{ fontSize: 13, color: '#6B7280' }}>
            Week of {week.weekStart.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
            {' – '}
            {week.weekEnd.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </div>
        </div>

        {/* KPI Row */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
          <KpiCard
            title="Total Spend"
            value={analytics?.summary?.total_spend != null
              ? `$${analytics.summary.total_spend.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
              : '—'}
            subtitle={`${transactions.filter(t => t.is_included).length} transactions`}
            loading={analyticsLoading}
          />
          <KpiCard
            title="Top Category"
            value={analytics?.summary?.top_category?.name
              ? (CATEGORY_LABELS[analytics.summary.top_category.name] || analytics.summary.top_category.name)
              : '—'}
            subtitle={analytics?.summary?.top_category?.pct != null
              ? `${analytics.summary.top_category.pct.toFixed(0)}% of spend`
              : undefined}
            loading={analyticsLoading}
          />
          <KpiCard
            title="Largest Transaction"
            value={analytics?.summary?.largest_transaction?.description || '—'}
            subtitle={analytics?.summary?.largest_transaction?.amount != null
              ? `$${analytics.summary.largest_transaction.amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
              : undefined}
            loading={analyticsLoading}
          />
        </div>

        {/* Charts Row */}
        <div style={{ display: 'flex', gap: 20, marginBottom: 24 }}>
          {/* Donut */}
          <div className="card" style={{ flex: '0 0 55%', minWidth: 0 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 16
            }}>
              <h2 style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>
                Spending by Category
              </h2>
              {selectedCategory && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, color: '#1B2B6B', fontWeight: 500,
                    fontFamily: 'Inter, sans-serif'
                  }}
                >
                  Clear filter ×
                </button>
              )}
            </div>
            {analyticsLoading ? (
              <div style={{ height: 280, background: '#F9FAFB', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Loading...
              </div>
            ) : (
              <CategoryDonut
                data={analytics?.category_breakdown || []}
                onCategoryClick={handleCategoryClick}
                selectedCategory={selectedCategory}
              />
            )}
          </div>

          {/* Daily bar */}
          <div className="card" style={{ flex: '0 0 45%', minWidth: 0 }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E', marginBottom: 16 }}>
              Daily Spending
            </h2>
            {analyticsLoading ? (
              <div style={{ height: 280, background: '#F9FAFB', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9CA3AF', fontSize: 13 }}>
                Loading...
              </div>
            ) : (
              <DailyBar
                data={analytics?.daily_totals || []}
                weekStartStr={week.weekStartStr}
              />
            )}
          </div>
        </div>

        {/* Transaction Table */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16
          }}>
            <h2 style={{ fontSize: 14, fontWeight: 600, color: '#1A1A2E' }}>
              Transactions
              {selectedCategory && (
                <span style={{ fontWeight: 400, color: '#6B7280', marginLeft: 8 }}>
                  — {CATEGORY_LABELS[selectedCategory] || selectedCategory}
                </span>
              )}
            </h2>
          </div>

          {txnLoading ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#9CA3AF' }}>
              Loading transactions...
            </div>
          ) : txnError ? (
            <div className="card" style={{ textAlign: 'center', padding: 40, color: '#DC2626' }}>
              Failed to load transactions.
              <button onClick={refetch} style={{ marginLeft: 8, color: '#1B2B6B', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, fontFamily: 'Inter, sans-serif' }}>
                Retry
              </button>
            </div>
          ) : (
            <TransactionTable
              transactions={transactions}
              showExcluded={false}
              onReclassify={handleReclassify}
              updateTransaction={updateTransaction}
              categoryFilter={selectedCategory}
            />
          )}
        </div>
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
