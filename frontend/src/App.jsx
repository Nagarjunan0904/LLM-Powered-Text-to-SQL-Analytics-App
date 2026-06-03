import { useState, useEffect, useRef } from 'react'
import { getSchema, getExamples, streamQuery } from './api/client'
import QueryInput from './components/QueryInput'
import SqlPanel from './components/SqlPanel'
import ResultsTable from './components/ResultsTable'
import AutoChart from './components/AutoChart'
import SchemaExplorer from './components/SchemaExplorer'

export default function App() {
  const [question, setQuestion]           = useState('')
  const [sql, setSql]                     = useState('')
  const [originalSql, setOriginalSql]     = useState('')
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

  // Ref gives synchronous read of streaming tokens across closure calls.
  // Used to snapshot attempt-1 SQL when the correction status event fires.
  const streamRef = useRef('')

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

    // Reset all output state for the new query
    streamRef.current = ''
    setLoading(true)
    setError(null)
    setSql('')
    setOriginalSql('')
    setColumns([])
    setRows([])
    setStreamingSQL('')
    setStatusMessage('')
    setAttempts(0)
    setCorrected(false)
    setLatencyMs(0)

    streamQuery(q, {
      onToken: (token) => {
        streamRef.current += token
        setStreamingSQL((prev) => prev + token)
      },
      onStatus: (content) => {
        setStatusMessage(content)
        // When the correction loop starts a new attempt, snapshot the
        // failed SQL and reset the streaming display for the fresh attempt.
        if (content.startsWith('Correcting')) {
          setOriginalSql(streamRef.current.trim())
          streamRef.current = ''
          setStreamingSQL('')
        }
      },
      onDone: (payload) => {
        setStreamingSQL('')
        setStatusMessage('')
        setSql(payload.sql)
        setAttempts(payload.attempts)
        setCorrected(payload.corrected)
        setLatencyMs(payload.latency_ms)
        setLoading(false)
        // Fetch structured rows + columns (SSE done event carries no rows)
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

  const showRightPanel = rows.length > 0

  return (
    <div className="flex flex-col h-screen text-neutral-100" style={{ background: '#0a0a0a' }}>

      {/* ── HEADER ── */}
      <header
        className="h-14 flex items-center px-5 flex-shrink-0 z-20"
        style={{
          background: '#0a0a0a',
          borderBottom: '1px solid #2a2a2a',
          boxShadow: '0 1px 0 0 rgba(245,158,11,0.3)',
        }}
      >
        {/* Logo */}
        <span className="text-amber-400 text-lg mr-2 leading-none">⚡</span>
        <span className="font-bold text-lg text-white tracking-tight">QueryMind</span>
        {/* Amber divider */}
        <span className="mx-3 w-px h-5 bg-amber-500/30 flex-shrink-0" />
        <span className="text-sm text-neutral-400">
          NYC Taxi · {schema?.row_count ? schema.row_count.toLocaleString() + ' rows' : '…'}
        </span>

        <div className="ml-auto flex items-center gap-3">
          {/* Live badge */}
          <span className="flex items-center gap-1.5 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs rounded-full px-2 py-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Live
          </span>
          {/* GitHub */}
          <a href="https://github.com/Nagarjunan0904/LLM-Powered-Text-to-SQL-Analytics-App" target="_blank" rel="noopener noreferrer" aria-label="GitHub" className="text-neutral-400 hover:text-amber-400 transition-colors">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
          </a>
        </div>
      </header>

      {/* ── BODY ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT SIDEBAR — SchemaExplorer owns collapse/expand */}
        <SchemaExplorer
          schema={schema}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen(p => !p)}
          onColumnClick={(col) =>
            setQuestion(prev => prev ? `${prev} ${col}` : col)
          }
        />

        {/* CENTER COLUMN — dot-grid background */}
        <div
          className="flex-1 flex flex-col overflow-hidden min-w-0 overflow-y-auto"
          style={{
            backgroundImage: 'radial-gradient(circle, #2a2a2a 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        >
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
            originalSql={originalSql}
          />

          <ResultsTable columns={columns} rows={rows} latencyMs={latencyMs} error={error} />
        </div>

        {/* RIGHT CHART PANEL */}
        {showRightPanel && (
          <aside
            className="w-80 flex-shrink-0 overflow-y-auto"
            style={{ background: '#111111', borderLeft: '1px solid #2a2a2a' }}
          >
            <AutoChart columns={columns} rows={rows} />
          </aside>
        )}
      </div>
    </div>
  )
}
