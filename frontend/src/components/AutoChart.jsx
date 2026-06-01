import { useState, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts'

// ── Column type inference ────────────────────────────────────────────────────

function detectColumnTypes(columns, rows) {
  const sample = rows.slice(0, 5)
  return columns.map((name, ci) => {
    const vals = sample
      .map(r => r[ci])
      .filter(v => v !== null && v !== undefined && v !== '')

    if (!vals.length) return { name, type: 'string' }

    // Date/timestamp: contains '-' AND ('T' or ':')
    if (vals.some(v => {
      const s = String(v)
      return s.includes('-') && (s.includes('T') || s.includes(':'))
    })) {
      return { name, type: 'date' }
    }

    // Numeric: every sampled value parses cleanly as a number
    if (vals.every(v => typeof v === 'number' || (!isNaN(parseFloat(v)) && String(v).trim() !== ''))) {
      return { name, type: 'numeric' }
    }

    return { name, type: 'string' }
  })
}

// ── Chart type selection ─────────────────────────────────────────────────────

function detectChartType(typedColumns, rowCount) {
  const strings  = typedColumns.filter(c => c.type === 'string')
  const numerics = typedColumns.filter(c => c.type === 'numeric')
  const dates    = typedColumns.filter(c => c.type === 'date')

  // 1 string + 1 numeric + at least 1 date → both bar and line are plausible
  if (strings.length === 1 && numerics.length === 1 && dates.length >= 1) return 'bar-line'
  // 1 string + 1 numeric
  if (strings.length === 1 && numerics.length === 1) return 'bar'
  // 1 date + 1 numeric
  if (dates.length === 1 && numerics.length === 1 && strings.length === 0) return 'line'
  // 2 numerics: treat as bar (categorical x) for small grouped results, scatter for large
  if (numerics.length === 2 && strings.length === 0 && dates.length === 0) {
    return rowCount <= 100 ? 'bar' : 'scatter'
  }

  return 'none'
}

// ── Data transformation ──────────────────────────────────────────────────────

function transformData(columns, rows, typedColumns, chartType, activeChart) {
  const stringCol   = typedColumns.find(c => c.type === 'string')
  const dateCol     = typedColumns.find(c => c.type === 'date')
  const numericCols = typedColumns.filter(c => c.type === 'numeric')

  let xCol, yCol

  if (chartType === 'scatter') {
    ;[xCol, yCol] = numericCols
  } else if (chartType === 'line' || (chartType === 'bar-line' && activeChart === 'line')) {
    xCol = dateCol
    yCol = numericCols[0]
  } else {
    // bar, bar-line/bar, or 2-numeric treated as bar
    xCol = stringCol ?? numericCols[0]
    yCol = stringCol ? numericCols[0] : numericCols[1]
  }

  if (!xCol || !yCol) return { data: [], xKey: '', yKey: '' }

  const xi = columns.indexOf(xCol.name)
  const yi = columns.indexOf(yCol.name)

  const data = rows.map(row => {
    const rawY = row[yi]
    const y = typeof rawY === 'number' ? rawY : parseFloat(rawY) || 0

    let x = row[xi]
    if (xCol.type === 'date' && x) {
      const d = new Date(x)
      if (!isNaN(d)) x = d.toLocaleDateString()
    } else {
      x = String(x ?? '')
      if (x.length > 12) x = x.slice(0, 12)
    }

    return { [xCol.name]: x, [yCol.name]: y }
  })

  return { data, xKey: xCol.name, yKey: yCol.name }
}

// ── Component ────────────────────────────────────────────────────────────────

const AMBER = '#f59e0b'
const GRID  = '#2a2a2a'
const TICK  = { fontSize: 11, fill: '#525252' }
const TOOLTIP_STYLE = {
  contentStyle: { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#d4d4d4', borderRadius: '8px' },
  itemStyle: { color: '#f5f5f5' },
  cursor: { fill: 'rgba(245,158,11,0.05)' },
}

export default function AutoChart({ columns, rows }) {
  const [activeChart, setActiveChart] = useState('bar')

  const typedColumns = useMemo(
    () => detectColumnTypes(columns, rows),
    [columns, rows]
  )
  const chartType = useMemo(
    () => detectChartType(typedColumns, rows.length),
    [typedColumns, rows.length]
  )
  const { data, xKey, yKey } = useMemo(
    () => transformData(columns, rows, typedColumns, chartType, activeChart),
    [columns, rows, typedColumns, chartType, activeChart]
  )

  if (!rows.length) return null

  // ── No-chart placeholder ─────────────────────────────────────────────────
  if (chartType === 'none') {
    return (
      <div className="rounded-xl p-6 text-center m-4 animate-fadeIn"
        style={{ background: '#111111', border: '1px solid #2a2a2a' }}>
        <p className="text-sm" style={{ color: '#525252' }}>Chart not available for this result shape</p>
        <p className="text-xs mt-2" style={{ color: '#3a3a3a' }}>
          Results with 1 text + 1 number, or 1 date + 1 number column auto-generate charts
        </p>
      </div>
    )
  }

  const resolvedType = chartType === 'bar-line' ? activeChart : chartType

  const chartLabel = {
    bar: 'Bar Chart', line: 'Line Chart', scatter: 'Scatter Chart',
    'bar-line': resolvedType === 'bar' ? 'Bar Chart' : 'Line Chart',
  }[chartType]

  return (
    <div className="rounded-xl p-4 m-4 animate-fadeIn"
      style={{ background: '#111111', border: '1px solid #2a2a2a' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wide" style={{ color: '#f59e0b' }}>
          Auto-detected: {chartLabel}
        </span>

        {/* Bar / Line toggle */}
        {chartType === 'bar-line' && (
          <div className="flex gap-1">
            {['Bar', 'Line'].map(label => {
              const val = label.toLowerCase()
              const active = activeChart === val
              return (
                <button
                  key={val}
                  onClick={() => setActiveChart(val)}
                  className="text-xs px-3 py-1 rounded-full transition-all"
                  style={active
                    ? { background: '#f59e0b', color: '#0a0a0a', fontWeight: 600 }
                    : { background: '#1a1a1a', border: '1px solid #2a2a2a', color: '#a3a3a3' }
                  }
                >
                  {label}
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Chart ── */}
      <ResponsiveContainer width="100%" height={280}>
        {resolvedType === 'bar' ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey={xKey} tick={TICK} angle={-35} textAnchor="end" height={60} />
            <YAxis tick={TICK} tickFormatter={v => v.toLocaleString()} />
            <Tooltip {...TOOLTIP_STYLE} formatter={v => v.toLocaleString()} />
            <Bar dataKey={yKey} fill={AMBER} radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : resolvedType === 'line' ? (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey={xKey} tick={TICK} />
            <YAxis tick={TICK} tickFormatter={v => v.toLocaleString()} />
            <Tooltip {...TOOLTIP_STYLE} formatter={v => v.toLocaleString()} />
            <Line
              dataKey={yKey}
              stroke={AMBER}
              strokeWidth={2}
              dot={{ r: 3 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        ) : (
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey={xKey} tick={TICK} name={xKey} />
            <YAxis dataKey={yKey} tick={TICK} name={yKey} />
            <Tooltip {...TOOLTIP_STYLE} cursor={{ strokeDasharray: '3 3' }} />
            <Scatter data={data} fill={AMBER} />
          </ScatterChart>
        )}
      </ResponsiveContainer>

      {/* ── Footer ── */}
      <p className="text-xs text-center mt-2" style={{ color: '#525252' }}>
        {rows.length} data points · {xKey} vs {yKey}
      </p>
    </div>
  )
}
