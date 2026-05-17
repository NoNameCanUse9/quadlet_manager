import { useEffect, useRef } from 'react'
import { useParams } from 'react-router'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export function TerminalPage() {
  const { id, exec_id } = useParams<{ id: string; exec_id: string }>()
  const containerRef = useRef<HTMLDivElement>(null)
  const terminalRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!containerRef.current || !exec_id) return

    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, monospace',
      theme: {
        background: '#09090b',
        foreground: '#e4e4e7',
        cursor: '#22c55e',
        selectionBackground: '#22c55e33',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    fitAddon.fit()
    terminalRef.current = terminal

    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const ws = new WebSocket(`${proto}//${window.location.host}/api/v1/containers/${id}/exec/${exec_id}/ws`)
    wsRef.current = ws

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'resize', cols: terminal.cols, rows: terminal.rows }))
    }

    ws.onmessage = (e) => {
      if (e.data instanceof Blob) {
        e.data.arrayBuffer().then(buf => terminal.write(new Uint8Array(buf)))
      } else {
        terminal.write(e.data)
      }
    }

    terminal.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data)
      }
    })

    terminal.onResize(({ cols, rows }) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols, rows }))
      }
    })

    const handleResize = () => fitAddon.fit()
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('resize', handleResize)
      ws.close()
      terminal.dispose()
    }
  }, [id, exec_id])

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-surface">
        <span className="text-xs text-text-secondary font-mono">
          Terminal — {id?.slice(0, 12)}
        </span>
        <button
          onClick={() => wsRef.current?.close()}
          className="px-2 py-1 text-xs text-red-400 hover:bg-red-500/10 rounded"
        >
          Disconnect
        </button>
      </div>
      <div ref={containerRef} className="flex-1 p-1" />
    </div>
  )
}
