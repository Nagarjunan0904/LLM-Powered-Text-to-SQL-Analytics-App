import { useState, useEffect, useMemo } from 'react'

// ── Type simplification map ───────────────────────────────────────────────────
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

// ── Schema text parser ────────────────────────────────────────────────────────
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
        return {
          name: trimmed.slice(0, sp),
          type: simplifyType(trimmed.slice(sp + 1)),
        }
      })
      return { name, columns }
    })
    .filter(Boolean)
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function SchemaExplorer({ schema, onColumnClick, sidebarOpen, onToggleSidebar }) {
  const [search, setSearch]                     = useState('')
  const [openTables, setOpenTables]             = useState(new Set())
  const [tablesInitialized, setTablesInitialized] = useState(false)

  const tables = useMemo(
    () => parseSchema(schema?.schema_text),
    [schema?.schema_text]
  )

  const totalColumns = useMemo(
    () => tables.reduce((s, t) => s + t.columns.length, 0),
    [tables]
  )

  // Default: all open when only 1 table, all closed when multiple
  useEffect(() => {
    if (!tablesInitialized && tables.length > 0) {
      setOpenTables(
        tables.length === 1 ? new Set(tables.map(t => t.name)) : new Set()
      )
      setTablesInitialized(true)
    }
  }, [tables, tablesInitialized])

  const filteredTables = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return tables
    return tables.reduce((acc, table) => {
      const tableMatch = table.name.toLowerCase().includes(q)
      const colMatches = table.columns.filter(
        c => c.name.toLowerCase().includes(q) || c.type.toLowerCase().includes(q)
      )
      if (tableMatch || colMatches.length > 0) {
        acc.push({ ...table, columns: tableMatch ? table.columns : colMatches })
      }
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

  // ── COLLAPSED STATE ───────────────────────────────────────────────────────
  if (!sidebarOpen) {
    return (
      <div
        className="w-8 flex-shrink-0 bg-gray-50 border-r border-gray-200 flex items-center justify-center cursor-pointer hover:bg-gray-100 transition-colors"
        onClick={onToggleSidebar}
        title="Expand schema sidebar"
      >
        <span className="text-gray-400 text-base select-none">›</span>
      </div>
    )
  }

  // ── EXPANDED STATE ────────────────────────────────────────────────────────
  return (
    <div className="w-64 flex-shrink-0 flex flex-col h-full bg-gray-50 border-r border-gray-200 overflow-hidden">

      {/* Header */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div>
            <span className="text-xs font-bold text-purple-700 bg-purple-50 border border-purple-200 rounded px-2 py-0.5 inline-block">
              DB: NYC Taxi
            </span>
            <p className="text-xs text-gray-400 mt-1 ml-0.5">
              {schema?.table_count ?? tables.length} table · {totalColumns} columns
            </p>
          </div>
          <button
            onClick={onToggleSidebar}
            className="text-gray-400 hover:text-gray-600 p-1 rounded ml-2 flex-shrink-0 text-sm leading-none"
            title="Collapse sidebar"
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
          className="w-full text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
        />
      </div>

      {/* Table list */}
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        {!schema ? (
          <p className="text-xs text-gray-400 px-2 py-3">Loading schema…</p>
        ) : filteredTables.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-3">No columns match "{search}"</p>
        ) : (
          filteredTables.map(table => {
            const isOpen = openTables.has(table.name)
            return (
              <div key={table.name} className="mt-2">

                {/* Table header (clickable, toggles columns) */}
                <button
                  onClick={() => toggleTable(table.name)}
                  className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors text-left"
                >
                  <span className="text-gray-400 text-xs w-3 flex-shrink-0">
                    {isOpen ? '▼' : '▶'}
                  </span>
                  <span className="font-medium text-gray-700 text-xs uppercase tracking-wide flex-1 truncate">
                    {table.name}
                  </span>
                  <span className="text-gray-400 text-xs flex-shrink-0">
                    {table.columns.length} cols
                  </span>
                </button>

                {/* Column rows */}
                {isOpen && (
                  <div className="ml-1 mt-0.5">
                    {table.columns.map(col => (
                      <button
                        key={col.name}
                        onClick={() => onColumnClick?.(col.name)}
                        title={`Click to insert '${col.name}' into query`}
                        className="w-full flex items-center justify-between px-3 py-1 rounded hover:bg-purple-50 cursor-pointer group transition-colors"
                      >
                        <span className="font-mono text-xs text-gray-600 group-hover:text-purple-600 transition-colors truncate">
                          {col.name}
                        </span>
                        <span className="text-gray-400 text-xs italic ml-2 flex-shrink-0">
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
      <div className="flex-shrink-0 border-t border-gray-100 px-3 py-2">
        <p className="text-xs text-gray-400 text-center">Click any column to add to query</p>
      </div>
    </div>
  )
}
