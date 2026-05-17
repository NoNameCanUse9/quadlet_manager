import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/store/useAuth'

export function LoginPage() {
  const navigate = useNavigate()
  const { login, loading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await login(username, password)
      navigate('/')
    } catch {}
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <h1 className="text-sm font-bold tracking-widest text-accent uppercase text-center">
          Quadlet Manager
        </h1>
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
          placeholder="Password"
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-background py-2 rounded text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : 'Login'}
        </button>
      </form>
    </div>
  )
}
