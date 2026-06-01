export default function SchemaExplorer({ schema }) {
  if (!schema) {
    return (
      <div className="p-4 text-xs text-gray-400">Loading schema…</div>
    )
  }

  const tables = schema.schema_text
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^Table:\s*(\w+)\s*\(columns:\s*(.+)\)$/)
      if (!match) return null
      const [, name, colStr] = match
      const columns = colStr.split(',').map((c) => {
        const parts = c.trim().split(' ')
        return { name: parts[0], type: parts.slice(1).join(' ') }
      })
      return { name, columns }
    })
    .filter(Boolean)

  return (
    <div className="p-3 overflow-auto h-full text-xs">
      <p className="font-semibold text-gray-700 mb-2">
        {tables.length} table{tables.length !== 1 ? 's' : ''}
      </p>
      {tables.map((table) => (
        <div key={table.name} className="mb-4">
          <p className="font-medium text-gray-800 mb-1">{table.name}</p>
          <ul className="space-y-0.5 ml-2">
            {table.columns.map((col) => (
              <li key={col.name} className="text-gray-500">
                <span className="text-gray-700">{col.name}</span>{' '}
                <span className="text-gray-400">{col.type}</span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}
