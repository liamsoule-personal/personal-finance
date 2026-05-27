import { useEffect, useRef } from 'react'

export default function ContextMenu({ x, y, items, onClose }) {
  const ref = useRef()

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  // Adjust position to stay in viewport
  const style = {
    position: 'fixed',
    top: y,
    left: x,
    zIndex: 1000,
    background: '#fff',
    borderRadius: 8,
    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
    border: '1px solid #E5E7EB',
    minWidth: 200,
    padding: '4px 0'
  }

  return (
    <div ref={ref} style={style}>
      {items.map((item, i) =>
        item.separator ? (
          <hr
            key={i}
            style={{ border: 'none', borderTop: '1px solid #E5E7EB', margin: '4px 0' }}
          />
        ) : (
          <button
            key={i}
            onClick={() => { item.action(); onClose() }}
            disabled={item.disabled}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: '8px 16px',
              border: 'none',
              background: 'none',
              fontSize: 14,
              fontFamily: 'Inter, -apple-system, sans-serif',
              cursor: item.disabled ? 'default' : 'pointer',
              color: item.danger ? '#DC2626' : '#1A1A2E',
              opacity: item.disabled ? 0.5 : 1,
              transition: 'background 0.1s'
            }}
            onMouseEnter={e => { if (!item.disabled) e.currentTarget.style.background = '#F3F4F6' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
          >
            {item.label}
          </button>
        )
      )}
    </div>
  )
}
