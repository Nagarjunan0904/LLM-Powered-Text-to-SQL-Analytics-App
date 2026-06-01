const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

export async function postQuery(question) {
  const res = await fetch(`${BASE_URL}/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error(err.detail || 'Query failed')
  }
  return res.json()
}

export async function getSchema() {
  const res = await fetch(`${BASE_URL}/schema`)
  if (!res.ok) throw new Error('Failed to fetch schema')
  return res.json()
}

export async function getExamples() {
  const res = await fetch(`${BASE_URL}/examples`)
  if (!res.ok) throw new Error('Failed to fetch examples')
  return res.json()
}

export function streamQuery(question, { onToken, onStatus, onDone, onError }) {
  const url = `${BASE_URL}/query/stream?question=${encodeURIComponent(question)}`
  let cancelled = false

  fetch(url)
    .then((res) => {
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      function pump() {
        if (cancelled) return
        reader.read().then(({ done, value }) => {
          if (done) return

          buffer += decoder.decode(value, { stream: true })
          const parts = buffer.split('\n\n')
          buffer = parts.pop() // keep incomplete tail

          for (const part of parts) {
            const line = part.trim()
            if (!line.startsWith('data:')) continue
            try {
              const payload = JSON.parse(line.slice(5).trim())
              if (payload.type === 'token') onToken?.(payload.content)
              else if (payload.type === 'status') onStatus?.(payload.content)
              else if (payload.type === 'done') onDone?.(payload)
              else if (payload.type === 'error') onError?.(payload.message)
              else if (payload.type === 'end') return // stop reading
            } catch {
              // ignore malformed lines
            }
          }

          pump()
        })
      }

      pump()
    })
    .catch((err) => onError?.(err.message))

  // Return a cancel function
  return () => { cancelled = true }
}
