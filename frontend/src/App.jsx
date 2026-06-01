import { useState, useEffect } from 'react'
import { getSchema, getExamples, streamQuery } from './api/client'
import QueryInput from './components/QueryInput'
import SqlPanel from './components/SqlPanel'
import ResultsTable from './components/ResultsTable'
import AutoChart from './components/AutoChart'
import SchemaExplorer from './components/SchemaExplorer'

function hasNumericColumn(columns, rows) {
  if (!columns.length || !rows.length) return false
  return columns.some((_, ci) =>
    rows.slice(0, 5).some((row) => typeof row[ci] === 'number' || !isNaN(Number(row[ci])))
  )
}

export default function App() {
  const [question, setQuestion]           = useState('')
  const [sql, setSql]                     = useState('')
  const [columns, setColumns]             = useState([])
  const [rows, setRows]                   = useState([])
  const [attempts, setAttempts]           = useState(0)
  const [corrected, setCorrected]         = useState(false)
  const [latencyMs, setLatencyMs]         = useState(0)
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)
  const [schema, setSchema]               = useState(null)
  const [examples, setExamples]           = useState([])
  const [sidebarOpen, setSidebarOpen]     = useState(true)
  const [streamingSQL, setStreamingSQL]   = useState('')
  const [statusMessage, setStatusMessage] = useState('')

  useEffect(() => {
    getSchema().then(setSchema).catch(console.error)
    getExamples().then(setExamples).catch(console.error)
  }, [])

  // overrideQuestion: passed by pill clicks to bypass async state
  function handleSubmit(overrideQuestion) {
    const q = typeof overrideQuestion === 'string'
      ? overrideQuestion.trim()
      : question.trim()
    if (!q || loading) return

    setLoading(true)
    setError(null)
    setSql('')
    setColumns([])
    setRows([])
    setStreamingSQL('')
    setStatusMessage('')
    setAttempts(0)
    setCorrected(false)
    setLatencyMs(0)

    streamQuery(q, {
      onStatus:  (content) => setStatusMessage(content),
      onToken:   (token)   => setStreamingSQL((prev) => prev + token),
      onDone: (payload) => {
        setStreamingSQL('')
        setStatusMessage('')
        setSql(payload.sql)
        setAttempts(payload.attempts)
        setCorrected(payload.corrected)
        setLatencyMs(payload.latency_ms)
        setLoading(false)
        // Fetch structured rows + columns (SSE done event has no rows)
        fetch('http://localhost:8000/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q }),
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.columns) setColumns(data.columns)
            if (data.rows)    setRows(data.rows)
          })
          .catch(console.error)
      },
      onError: (msg) => {
        setError(msg)
        setLoading(false)
        setStatusMessage('')
      },
    })
  }

  const showRightPanel = rows.length > 0 && hasNumericColumn(columns, rows)

  return (
    <div className="flex flex-col h-screen bg-white text-gray-900">

      {/* ── HEADER ── */}
      <header className="h-14 bg-gray-900 text-white flex items-center px-4 flex-shrink-0">
        <span className="font-semibold text-lg tracking-tight">Text-to-SQL</span>
        <span className="mx-3 text-gray-500">|</span>
        <span className="text-sm text-gray-400">NYC Taxi Dataset · 38M rows</span>
        <div className="ml-auto">
          <a href="#" aria-label="GitHub" className="text-gray-400 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR */}
        <aside
          className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-200 overflow-hidden flex-shrink-0 bg-gray-50 border-r border-gray-200 flex flex-col relative`}
        >
          <button
            onClick={() => setSidebarOpen(false)}
            className="absolute top-2 right-2 text-gray-400 hover:text-gray-600 z-10 text-xs"
            title="Collapse sidebar"
          >
            ✕
          </button>
          <SchemaExplorer schema={schema} />
        </aside>

        {/* SIDEBAR RE-OPEN TOGGLE */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="w-6 flex-shrink-0 bg-gray-50 border-r border-gray-200 hover:bg-gray-100 text-gray-400 flex items-center justify-center text-base"
            title="Open sidebar"
          >
            ›
          </button>
        )}

        {/* CENTER COLUMN */}
        <div className="flex-1 flex flex-col overflow-hidden min-w-0">
          <QueryInput
            question={question}
            setQuestion={setQuestion}
            onSubmit={handleSubmit}
            loading={loading}
            examples={examples}
            corrected={corrected}
            attempts={attempts}
            latencyMs={latencyMs}
            statusMessage={statusMessage}
            streamingSQL={streamingSQL}
            error={error}
          />

          <SqlPanel
            sql={sql}
            attempts={attempts}
            corrected={corrected}
            latencyMs={latencyMs}
          />

          <ResultsTable columns={columns} rows={rows} />
        </div>

        {/* RIGHT CHART PANEL */}
        {showRightPanel && (
          <aside className="w-80 flex-shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-2 border-b border-gray-200 text-xs font-medium text-gray-600">
              Chart
            </div>
            <AutoChart columns={columns} rows={rows} />
          </aside>
        )}
      </div>
    </div>
  )
}
