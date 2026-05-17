import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/store/useAuth'
import { Languages } from 'lucide-react'
import i18n from '@/i18n'

export function InitPage() {
  const navigate = useNavigate()
  const { initAdmin, loading, error } = useAuth()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')

  const isZh = i18n.language === 'zh'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirm) return
    try {
      await initAdmin(username, password)
      navigate('/')
    } catch {}
  }

  const toggleLang = () => {
    const next = isZh ? 'en' : 'zh'
    i18n.changeLanguage(next)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-sm font-bold tracking-widest text-accent uppercase">
            Quadlet Manager
          </h1>
          <p className="text-xs text-text-muted">
            {isZh ? '创建管理员账号' : 'Create your admin account'}
          </p>
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
          >
            <Languages size={12} />
            {isZh ? 'English' : '中文'}
          </button>
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
          placeholder={isZh ? '用户名' : 'Username'}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isZh ? '密码（至少6位）' : 'Password (min 6 chars)'}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder={isZh ? '确认密码' : 'Confirm password'}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading || password !== confirm || password.length < 6}
          className="w-full bg-accent text-background py-2 rounded text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : (isZh ? '创建管理员' : 'Create Admin')}
        </button>
      </form>
    </div>
  )
}
