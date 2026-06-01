import { useState, useEffect, useMemo } from 'react'

const TYPE_MAP = {
  'timestamp without time zone': 'timestamp',
  'timestamp with time zone':    'timestamp',
  'character varying':           'varchar',
  'double precision':            'float',
  'integer':                     'int',
  'bigint':                      'bigint',
  'boolean':                     'bool',
}

function simplifyType(raw) {
  const t = raw.trim()
  return TYPE_MAP[t] ?? t.split(' ')[0]
}

function parseSchema(schemaText) {
  if (!schemaText) return []
  return schemaText
    .split('\n')
    .filter(Boolean)
    .map(line => {
      const m = line.match(/^Table:\s*(\w+)\s*\(columns:\s*(.+)\)$/)
      if (!m) return null
      const [, name, colStr] = m
      const columns = colStr.split(',').map(c => {
        const trimmed = c.trim()
        const sp = trimmed.indexOf(' ')
        if (sp === -1) return { name: trimmed, type: '' }
        return { name: trimmed.slice(0, sp), type: simplifyType(trimmed.slice(sp + 1)) }
      })
      return { name, columns }
    })
    .filter(Boolean)
}

export default function SchemaExplorer({ schema, onColumnClick, sidebarOpen, onToggleSidebar }) {
  const [search, setSearch]                       = useState('')
  const [openTables, setOpenTables]               = useState(new Set())
  const [tablesInitialized, setTablesInitialized] = useState(false)

  const tables = useMemo(() => parseSchema(schema?.schema_text), [schema?.schema_text])
  const totalColumns = useMemo(() => tables.reduce((s, t) => s + t.columns.length, 0), [tables])

  useEffect(() => {
    if (!tablesInitialized && tables.length > 0) {
      setOpenTables(tables.length === 1 ? new Set(tables.map(t => t.name)) : new Set())
      setTablesInitialized(true)
    }
  }, [tables, tablesInitialized])

  const filteredTables = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return tables
    return tables.reduce((acc, table) => {
      const tableMatch = table.name.toLowerCase().includes(q)
      const colMatches = table.columns.filter(c =>
        c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
      )
      if (tableMatch || colMatches.length > 0)
        acc.push({ ...table, columns: tableMatch ? table.columns : colMatches })
      return acc
    }, [])
  }, [tables, search])

  function toggleTable(name) {
    setOpenTables(prev => {
      const next = new Set(prev)
      next.has(name) ? next.delete(name) : next.add(name)
      return next
    })
  }

  // ── COLLAPSED ──────────────────────────────────────────────────────────────
  if (!sidebarOpen) {
    return (
      <div
        className="w-8 flex-shrink-0 flex items-center justify-center cursor-pointer transition-colors"
        style={{ background: '#111111', borderRight: '1px solid #2a2a2a' }}
        onClick={onToggleSidebar}
        title="Expand schema sidebar"
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.05)' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#111111' }}
      >
        <span className="select-none" style={{ color: '#525252' }}>›</span>
      </div>
    )
  }

  // ── EXPANDED ───────────────────────────────────────────────────────────────
  return (
    <div
      className="w-64 flex-shrink-0 flex flex-col h-full overflow-hidden"
      style={{ background: '#111111', borderRight: '1px solid #2a2a2a' }}
    >
      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2" style={{ borderBottom: '1px solid #2a2a2a' }}>
        <div className="flex items-start justify-between">
          <div>
            <span
              className="text-xs font-bold inline-flex items-center gap-1.5 px-2 py-0.5 rounded"
              style={{
                background: 'rgba(245,158,11,0.1)',
                color: '#f59e0b',
                border: '1px solid rgba(245,158,11,0.3)',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
              DB: NYC Taxi
            </span>
            <p className="text-xs mt-1 ml-0.5" style={{ color: '#525252' }}>
              {schema?.table_count ?? tables.length} table · {totalColumns} columns
            </p>
          </div>
          <button
            onClick={onToggleSidebar}
            className="p-1 rounded ml-2 flex-shrink-0 text-sm leading-none transition-colors"
            style={{ color: '#525252' }}
            title="Collapse sidebar"
            onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#525252' }}
          >
            ‹
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex-shrink-0 px-3 py-2">
        <input
          type="text"
          placeholder="Search columns..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-xs rounded-lg px-3 py-1.5 outline-none transition-all"
          style={{
            background: '#1a1a1a',
            border: '1px solid #2a2a2a',
            color: '#d4d4d4',
          }}
          onFocus={e => {
            e.target.style.border = '1px solid rgba(245,158,11,0.5)'
            e.target.style.boxShadow = '0 0 0 2px rgba(245,158,11,0.15)'
          }}
          onBlur={e => {
            e.target.style.border = '1px solid #2a2a2a'
            e.target.style.boxShadow = 'none'
          }}
        />
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!schema ? (
          <p className="text-xs px-2 py-3" style={{ color: '#525252' }}>Loading schema…</p>
        ) : filteredTables.length === 0 ? (
          <p className="text-xs px-2 py-3" style={{ color: '#525252' }}>No columns match "{search}"</p>
        ) : (
          filteredTables.map(table => {
            const isOpen = openTables.has(table.name)
            return (
              <div key={table.name} className="mt-2">
                <button
                  onClick={() => toggleTable(table.name)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg transition-colors text-left"
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span className="text-xs w-3 flex-shrink-0" style={{ color: '#525252' }}>
                    {isOpen ? '▼' : '▶'}
                  </span>
                  <span className="font-medium text-xs uppercase tracking-wide flex-1 truncate"
                    style={{ color: '#a3a3a3' }}>
                    {table.name}
                  </span>
                  <span className="text-xs flex-shrink-0" style={{ color: '#525252' }}>
                    {table.columns.length} cols
                  </span>
                </button>

                {isOpen && (
                  <div className="ml-1 mt-0.5">
                    {table.columns.map(col => (
                      <button
                        key={col.name}
                        onClick={() => onColumnClick?.(col.name)}
                        title={`Click to insert '${col.name}' into query`}
                        className="w-full flex items-center justify-between px-3 py-1 rounded cursor-pointer transition-all group"
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.1)' }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      >
                        <span
                          className="font-mono text-xs truncate transition-colors"
                          style={{ color: '#a3a3a3' }}
                          onMouseEnter={e => { e.currentTarget.style.color = '#f59e0b' }}
                          onMouseLeave={e => { e.currentTarget.style.color = '#a3a3a3' }}
                        >
                          {col.name}
                        </span>
                        <span className="text-xs italic ml-2 flex-shrink-0" style={{ color: '#525252' }}>
                          {col.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer */}
      <div className="flex-shrink-0 px-3 py-2" style={{ borderTop: '1px solid #2a2a2a' }}>
        <p className="text-xs text-center" style={{ color: '#525252' }}>Click any column to add to query</p>
      </div>
    </div>
  )
}
