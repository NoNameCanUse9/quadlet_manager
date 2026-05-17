import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/store/useAuth'
import { Languages } from 'lucide-react'

export function LoginPage() {
  const { t, i18n } = useTranslation()
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

  const toggleLang = () => {
    const next = i18n.language === 'en' ? 'zh' : 'en'
    i18n.changeLanguage(next)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <form onSubmit={handleSubmit} className="w-80 space-y-4">
        <div className="text-center space-y-2">
          <h1 className="text-xl font-bold tracking-widest text-accent uppercase">
            Quadlet Manager
          </h1>
          <button
            type="button"
            onClick={toggleLang}
            className="inline-flex items-center gap-1 px-2 py-1 text-[10px] text-text-muted hover:text-text-primary transition-colors"
          >
            <Languages size={12} />
            {i18n.language === 'en' ? '中文' : 'English'}
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
          placeholder={t('settings.language') === '语言' ? '用户名' : 'Username'}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          autoFocus
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t('settings.language') === '语言' ? '密码' : 'Password'}
          className="w-full bg-surface border border-border rounded px-3 py-2 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-accent text-background py-2 rounded text-xs font-medium hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {loading ? '...' : (i18n.language === 'zh' ? '登录' : 'Login')}
        </button>
      </form>
    </div>
  )
}
