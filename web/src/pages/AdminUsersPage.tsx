import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/store/useAuth'
import { Trash2, UserPlus } from 'lucide-react'

interface User {
  id: number
  username: string
  role: string
  createdAt: string
}

export function AdminUsersPage() {
  const { t } = useTranslation()
  const currentUser = useAuth((s) => s.user)
  const token = useAuth((s) => s.token)
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showAdd, setShowAdd] = useState(false)
  const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' })

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/auth/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) setUsers(await res.json())
    } catch {}
    setLoading(false)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleAdd = async () => {
    try {
      const res = await fetch('/api/v1/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newUser),
      })
      if (res.ok) {
        setShowAdd(false)
        setNewUser({ username: '', password: '', role: 'user' })
        fetchUsers()
      }
    } catch {}
  }

  const handleDelete = async (id: number) => {
    if (!confirm(t('users.deleteConfirm') || 'Delete this user?')) return
    try {
      await fetch(`/api/v1/auth/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchUsers()
    } catch {}
  }

  return (
    <div className="space-y-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold tracking-wider text-text-primary uppercase">{t('users.title')}</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-accent hover:bg-accent-dim border border-accent/25 rounded transition-all font-semibold"
        >
          <UserPlus size={14} />
          {t('users.addUser')}
        </button>
      </div>

      {showAdd && (
        <div className="border border-border rounded bg-surface p-4 space-y-3 max-w-md">
          <input
            type="text"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            placeholder={t('users.username') || 'Username'}
            className="w-full bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder={t('users.password') || 'Password'}
            className="w-full bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="bg-surface-raised border border-border rounded px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent cursor-pointer"
            >
              <option value="user">{t('users.roleUser')}</option>
              <option value="admin">{t('users.roleAdmin')}</option>
            </select>
            <button
              onClick={handleAdd}
              className="px-4 py-1.5 bg-accent text-background rounded text-sm hover:bg-accent/90 transition-colors font-semibold ml-auto"
            >
              {t('common.create')}
            </button>
          </div>
        </div>
      )}

      {/* Main List Table */}
      <div className="border border-border rounded bg-surface overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-text-muted font-medium">{t('common.loading')}</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-raised text-text-secondary border-b border-border">
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('users.username')}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('users.role')}</th>
                <th className="px-4 py-3 text-left font-semibold text-text-muted text-xs uppercase tracking-wider">{t('users.created')}</th>
                <th className="px-4 py-3 text-right font-semibold text-text-muted text-xs uppercase tracking-wider">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border hover:bg-surface-raised/50 transition-colors"
                >
                  <td className="px-4 py-3 text-text-primary font-semibold">{u.username}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-semibold uppercase ${
                        u.role === 'admin'
                          ? 'bg-accent-dim text-accent border border-accent/20'
                          : 'bg-surface-raised text-text-muted border border-border'
                      }`}
                    >
                      {u.role === 'admin' ? t('users.roleAdmin') : t('users.roleUser')}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-text-secondary">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        title={t('common.remove') || 'Remove'}
                        className="p-1.5 text-text-secondary hover:text-red-400 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {users.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-text-secondary font-medium">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
