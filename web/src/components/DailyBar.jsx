import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

const DAY_ABBRS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatDollars(v) {
  if (v === 0) return '$0'
  if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'k'
  return '$' + Number(v).toFixed(0)
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null
  const d = payload[0].payload
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: 13
    }}>
      <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{label}</div>
      <div style={{ color: '#1B2B6B', fontWeight: 700 }}>
        ${Number(d.amount).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
      </div>
      <div style={{ color: '#6B7280', fontSize: 12 }}>
        {d.transaction_count} transaction{d.transaction_count !== 1 ? 's' : ''}
      </div>
    </div>
  )
}

export default function DailyBar({ data = [], weekStartStr }) {
  // Build full 7-day array Mon–Sun
  const byDate = {}
  data.forEach(d => { byDate[d.date] = d })

  const chartData = DAY_ABBRS.map((label, i) => {
    let date = ''
    if (weekStartStr) {
      const d = new Date(weekStartStr + 'T00:00:00')
      d.setDate(d.getDate() + i)
      date = d.toISOString().split('T')[0]
    }
    const existing = byDate[date] || {}
    return {
      label,
      date,
      amount: existing.amount || 0,
      transaction_count: existing.transaction_count || 0
    }
  })

  const maxAmount = Math.max(...chartData.map(d => d.amount), 0)

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart
        data={chartData}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barCategoryGap="30%"
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#F3F4F6"
          vertical={false}
        />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 12, fill: '#6B7280', fontFamily: 'Inter, sans-serif' }}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9CA3AF', fontFamily: 'Inter, sans-serif' }}
          tickFormatter={formatDollars}
          width={44}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: '#F0F3FF', radius: 4 }}
        />
        <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
          {chartData.map((entry, i) => (
            <Cell
              key={i}
              fill={entry.amount === maxAmount && entry.amount > 0 ? '#1B2B6B' : '#BFCAF0'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
