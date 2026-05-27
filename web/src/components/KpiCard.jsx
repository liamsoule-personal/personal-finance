export default function KpiCard({ title, value, subtitle, loading }) {
  return (
    <div className="card" style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: '#6B7280',
        marginBottom: 8
      }}>
        {title}
      </div>
      {loading ? (
        <div style={{
          height: 36,
          background: '#F3F4F6',
          borderRadius: 6,
          marginBottom: 8,
          animation: 'pulse 1.5s ease-in-out infinite'
        }} />
      ) : (
        <div style={{
          fontSize: 28,
          fontWeight: 700,
          color: '#1B2B6B',
          marginBottom: 4,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}>
          {value}
        </div>
      )}
      {subtitle && (
        <div style={{ fontSize: 13, color: '#6B7280' }}>{subtitle}</div>
      )}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}
