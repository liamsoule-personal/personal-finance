import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import { CATEGORY_LABELS, CATEGORY_COLORS } from '../lib/categories'

const OTHER_COLOR = '#CBD5E1'

function formatDollars(v) {
  return '$' + Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null
  const { name, value, pct } = payload[0].payload
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #E5E7EB',
      borderRadius: 8,
      padding: '10px 14px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      fontSize: 13
    }}>
      <div style={{ fontWeight: 600, color: '#1A1A2E', marginBottom: 4 }}>{name}</div>
      <div style={{ color: '#1B2B6B', fontWeight: 700 }}>{formatDollars(value)}</div>
      <div style={{ color: '#6B7280', fontSize: 12 }}>{pct?.toFixed(1)}% of spend</div>
    </div>
  )
}

function CenterLabel({ viewBox, total }) {
  const { cx, cy } = viewBox
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle">
      <tspan x={cx} dy="-8" style={{ fontSize: 11, fill: '#6B7280', fontFamily: 'Inter, sans-serif' }}>
        Total
      </tspan>
      <tspan x={cx} dy="22" style={{ fontSize: 18, fontWeight: 700, fill: '#1B2B6B', fontFamily: 'Inter, sans-serif' }}>
        {formatDollars(total)}
      </tspan>
    </text>
  )
}

export default function CategoryDonut({ data = [], onCategoryClick, selectedCategory }) {
  if (!data || data.length === 0) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 280, color: '#6B7280', fontSize: 13 }}>
        No spending data
      </div>
    )
  }

  const sorted = [...data].sort((a, b) => b.amount - a.amount)
  const top8 = sorted.slice(0, 8)
  const rest = sorted.slice(8)
  const otherAmount = rest.reduce((s, d) => s + d.amount, 0)
  const total = sorted.reduce((s, d) => s + d.amount, 0)

  const chartData = top8.map(d => ({
    name: CATEGORY_LABELS[d.category] || d.category,
    value: d.amount,
    category: d.category,
    color: CATEGORY_COLORS[d.category] || OTHER_COLOR,
    pct: total > 0 ? (d.amount / total) * 100 : 0
  }))

  if (otherAmount > 0) {
    chartData.push({
      name: 'Other',
      value: otherAmount,
      category: 'OTHER',
      color: OTHER_COLOR,
      pct: total > 0 ? (otherAmount / total) * 100 : 0
    })
  }

  return (
    <div>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={68}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            onClick={(d) => onCategoryClick && onCategoryClick(d.category === selectedCategory ? null : d.category)}
            style={{ cursor: 'pointer' }}
            label={false}
          >
            {chartData.map((entry, i) => (
              <Cell
                key={entry.category}
                fill={entry.color}
                stroke={selectedCategory === entry.category ? '#1B2B6B' : 'transparent'}
                strokeWidth={selectedCategory === entry.category ? 2 : 0}
                opacity={selectedCategory && selectedCategory !== entry.category ? 0.45 : 1}
                outerRadius={selectedCategory === entry.category ? 98 : 90}
              />
            ))}
            <CenterLabel total={total} />
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '6px 16px',
        marginTop: 8,
        maxHeight: 160,
        overflowY: 'auto'
      }}>
        {chartData.map(entry => (
          <div
            key={entry.category}
            onClick={() => onCategoryClick && onCategoryClick(entry.category === selectedCategory ? null : entry.category)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: 'pointer',
              padding: '3px 6px',
              borderRadius: 6,
              background: selectedCategory === entry.category ? '#F0F3FF' : 'transparent',
              transition: 'background 0.15s',
              opacity: selectedCategory && selectedCategory !== entry.category ? 0.5 : 1
            }}
          >
            <div style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: entry.color,
              flexShrink: 0
            }} />
            <div style={{ fontSize: 11, color: '#6B7280', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#1A1A2E', flexShrink: 0 }}>
              {formatDollars(entry.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
