import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/store/useAuth'

export function InitPage() {
  const navigate = useNavigate()
  const { initAdmin, loading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return
    try {
      await initAdmin(username, password)
      navigate('/')
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <div className="text-center space-y-1">
          <h1 className="text-sm font-bold tracking-widest text-accent uppercase">
            Quadlet Manager
          </h1>
          <p className="text-xs text-text-muted">Create your admin account</p>
        </div>
        {error && (
          <div className="text-xs text-danger bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
            {error}
          </div>
        )}
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || password !== confirm || password.length < 6}
          className="w-full bg-accent text-background py-2 rounded text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Create Admin'}
        </button>
      </form>
    </div>
  )
}
