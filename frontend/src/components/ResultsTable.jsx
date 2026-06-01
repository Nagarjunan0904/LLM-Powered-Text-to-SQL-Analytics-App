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
  if (!active) return <span className="text-gray-300 text-xs ml-1">↕</span>
  return <span className="text-purple-500 text-xs ml-1">{dir === 'asc' ? '↑' : '↓'}</span>
}

export default function ResultsTable({ columns, rows, latencyMs, error }) {
  const [sortCol, setSortCol] = useState(null)
  const [sortDir, setSortDir] = useState('asc')
  const [page, setPage]       = useState(0)

  // Reset sort + page whenever a new result set arrives
  useEffect(() => {
    setPage(0)
    setSortCol(null)
    setSortDir('asc')
  }, [rows, columns])

  const sortedRows = useMemo(() => {
    if (sortCol === null) return rows
    return [...rows].sort((a, b) => {
      const av = a[sortCol], bv = b[sortCol]
      const an = Number(av), bn = Number(bv)
      if (!isNaN(an) && !isNaN(bn) && av !== '' && bv !== '') {
        return sortDir === 'asc' ? an - bn : bn - an
      }
      const as = String(av ?? ''), bs = String(bv ?? '')
      return sortDir === 'asc' ? as.localeCompare(bs) : bs.localeCompare(as)
    })
  }, [rows, sortCol, sortDir])

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageRows   = sortedRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(ci) {
    if (sortCol === ci) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(ci)
      setSortDir('asc')
    }
    setPage(0)
  }

  function handleExport() {
    const header = columns.map(escapeCsv).join(',')
    const body   = sortedRows.map(row => row.map(escapeCsv).join(',')).join('\n')
    const blob   = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' })
    const url    = URL.createObjectURL(blob)
    const a      = Object.assign(document.createElement('a'), { href: url, download: 'results.csv' })
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  // ── Nothing yet ──────────────────────────────────────────────────────────
  const hasQuery = columns.length > 0 || rows.length > 0 || !!error || latencyMs > 0
  if (!hasQuery) return null

  // ── Error state ───────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="mx-4 mb-4 flex-shrink-0">
        <div className="bg-red-50 border border-red-300 text-red-700 rounded-xl px-4 py-3 text-sm leading-relaxed">
          <span className="font-semibold">Query error: </span>{error}
        </div>
      </div>
    )
  }

  // ── Empty state (query ran, zero rows back) ───────────────────────────────
  if (rows.length === 0) {
    return (
      <div className="mx-4 mb-4 flex-shrink-0 rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-100 text-sm text-gray-500">
          0 rows returned{latencyMs > 0 ? ` in ${latencyMs}ms` : ''}
        </div>
        <div className="py-10 text-center text-gray-400 bg-white text-sm">
          No results returned
        </div>
      </div>
    )
  }

  // ── Full table ────────────────────────────────────────────────────────────
  return (
    <div className="mx-4 mb-4 flex flex-col bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex-shrink-0">

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 bg-gray-50 flex-shrink-0">
        <span className="text-sm text-gray-600">
          <span className="font-semibold text-gray-800">{rows.length.toLocaleString()}</span>
          {' rows returned'}
          {latencyMs > 0 && (
            <span className="text-gray-400"> in {latencyMs}ms</span>
          )}
        </span>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs border border-gray-300 rounded-lg px-3 py-1.5 hover:bg-white transition-colors text-gray-600"
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
          <thead className="sticky top-0 bg-gray-100 z-10">
            <tr>
              {columns.map((col, ci) => (
                <th
                  key={ci}
                  onClick={() => handleSort(ci)}
                  className="text-left px-4 py-2.5 font-medium text-gray-600 border-b border-gray-200 whitespace-nowrap cursor-pointer hover:bg-gray-200 select-none transition-colors"
                >
                  <span className="inline-flex items-center">
                    {col}
                    <SortIcon active={sortCol === ci} dir={sortDir} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((row, i) => (
              <tr
                key={i}
                className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} hover:bg-purple-50 transition-colors`}
              >
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-4 py-2 border-b border-gray-100 text-gray-700 whitespace-nowrap"
                  >
                    {cell === null
                      ? <span className="text-gray-300 italic text-xs">null</span>
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
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-100 bg-gray-50 flex-shrink-0">
          <span className="text-xs text-gray-500">
            Page <span className="font-medium text-gray-700">{page + 1}</span> of{' '}
            <span className="font-medium text-gray-700">{totalPages}</span>
            {' '}·{' '}
            showing rows {(page * PAGE_SIZE + 1).toLocaleString()}–
            {Math.min((page + 1) * PAGE_SIZE, rows.length).toLocaleString()}
            {' '}of {rows.length.toLocaleString()}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
              className="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
