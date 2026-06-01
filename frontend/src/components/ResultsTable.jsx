import { useState, useEffect, useMemo } from 'react'

const PAGE_SIZE = 25

function escapeCsv(val) {
  if (val === null || val === undefined) return ''
  const s = String(val)
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? `"${s.replace(/"/g, '""')}"`
    : s
}

function SortIcon({ active, dir }) {
  if (!active) return <span className="ml-1 text-xs" style={{ color: '#525252' }}>↕</span>
  return <span className="ml-1 text-xs" style={{ color: '#f59e0b' }}>{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function ResultsTable({ columns, rows, latencyMs, error }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage]       = useState(0)

  useEffect(() => {
    setPage(0); setSortCol(null); setSortDir('asc')
  }, [rows, columns])

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const an = Number(av), bn = Number(bv)
      if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '')
        return sortDir === 'asc' ? an - bn : bn - an
      const as = String(av ?? ''), bs = String(bv ?? '')
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }, [rows, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageRows   = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(ci) {
    if (sortCol === ci) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(ci); setSortDir('asc') }
    setPage(0)
  }

  function handleExport() {
    const header = columns.map(escapeCsv).join(',')
    const body   = sortedRows.map(row => row.map(escapeCsv).join(',')).join('\n')
    const blob   = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const a      = Object.assign(document.createElement('a'), { href: url, download: 'results.csv' })
    document.body.appendChild(a); a.click()
    document.body.removeChild(a); URL.revokeObjectURL(url)
  }

  const hasQuery = columns.length > 0 || rows.length > 0 || !!error || latencyMs > 0
  if (!hasQuery) return null

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-4 mb-4 flex-shrink-0">
        <div className="rounded-xl px-4 py-3 text-sm leading-relaxed"
          style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#f87171' }}>
          <span className="font-semibold">Query error: </span>{error}
        </div>
      </div>
    )
  }

  // ── Empty ──────────────────────────────────────────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="mx-4 mb-4 flex-shrink-0 rounded-xl overflow-hidden animate-fadeInUp"
        style={{ border: '1px solid #2a2a2a', background: '#111111' }}>
        <div className="flex items-center px-4 py-2 text-sm" style={{ color: '#525252', borderBottom: '1px solid #2a2a2a' }}>
          0 rows returned{latencyMs > 0 ? ` in ${latencyMs}ms` : ''}
        </div>
        <div className="py-10 text-center text-sm" style={{ color: '#525252' }}>
          No results returned
        </div>
      </div>
    )
  }

  // ── Full table ─────────────────────────────────────────────────────────────
  return (
    <div className="mx-4 mb-4 flex flex-col rounded-xl overflow-hidden flex-shrink-0 animate-fadeInUp"
      style={{ background: '#111111', border: '1px solid #2a2a2a', animationDelay: '75ms' }}>

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
        style={{ borderBottom: '1px solid #2a2a2a', background: '#111111' }}>
        <span className="text-sm" style={{ color: '#a3a3a3' }}>
          <span className="font-semibold" style={{ color: '#f5f5f5' }}>{rows.length.toLocaleString()}</span>
          {' rows returned'}
          {latencyMs > 0 && <span style={{ color: '#525252' }}> in {latencyMs}ms</span>}
        </span>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 transition-colors"
          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#a3a3a3' }}
          onMouseEnter={e => {
            e.currentTarget.style.background = 'rgba(245,158,11,0.1)'
            e.currentTarget.style.color = '#f59e0b'
            e.currentTarget.style.border = '1px solid rgba(245,158,11,0.3)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
            e.currentTarget.style.color = '#a3a3a3'
            e.currentTarget.style.border = '1px solid #2a2a2a'
          }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Export CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            <tr style={{ background: '#1a1a1a' }}>
              {columns.map((col, ci) => (
                <th key={ci} onClick={() => handleSort(ci)}
                  className="text-left px-4 py-2.5 text-xs uppercase tracking-wide whitespace-nowrap cursor-pointer select-none transition-colors"
                  style={{
                    color: sortCol === ci ? '#f59e0b' : '#a3a3a3',
                    fontWeight: sortCol === ci ? 600 : 500,
                    borderBottom: '1px solid #2a2a2a',
                  }}
                  onMouseEnter={e => { if (sortCol !== ci) e.currentTarget.style.color = '#f5f5f5' }}
                  onMouseLeave={e => { if (sortCol !== ci) e.currentTarget.style.color = '#a3a3a3' }}
                >
                  <span className="inline-flex items-center">
                    {col}<SortIcon active={sortCol === ci} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr key={i}
                style={{ background: i % 2 === 0 ? '#111111' : '#0f0f0f' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.background = i % 2 === 0 ? '#111111' : '#0f0f0f' }}
              >
                {row.map((cell, j) => (
                  <td key={j} className="px-4 py-2 whitespace-nowrap text-sm"
                    style={{ color: '#d4d4d4', borderBottom: '1px solid rgba(42,42,42,0.5)' }}>
                    {cell === null
                      ? <span className="italic text-xs" style={{ color: '#525252' }}>null</span>
                      : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
          style={{ borderTop: '1px solid #2a2a2a', background: '#111111' }}>
          <span className="text-xs" style={{ color: '#525252' }}>
            Page <span style={{ color: '#a3a3a3', fontWeight: 500 }}>{page + 1}</span> of{' '}
            <span style={{ color: '#a3a3a3', fontWeight: 500 }}>{totalPages}</span>
            {' '}·{' '}rows {(page * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min((page + 1) * PAGE_SIZE, rows.length).toLocaleString()} of {rows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            {[['← Prev', page === 0, () => setPage(p => Math.max(0, p - 1))],
              ['Next →', page === totalPages - 1, () => setPage(p => Math.min(totalPages - 1, p + 1))]
            ].map(([label, disabled, onClick]) => (
              <button key={label} onClick={onClick} disabled={disabled}
                className="text-xs px-3 py-1 rounded-lg transition-colors"
                style={{
                  background: '#1a1a1a', border: '1px solid #2a2a2a',
                  color: disabled ? '#525252' : '#a3a3a3',
                  opacity: disabled ? 0.3 : 1,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => { if (!disabled) { e.currentTarget.style.background = 'rgba(245,158,11,0.1)'; e.currentTarget.style.color = '#f59e0b' } }}
                onMouseLeave={e => { if (!disabled) { e.currentTarget.style.background = '#1a1a1a'; e.currentTarget.style.color = '#a3a3a3' } }}
              >{label}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
