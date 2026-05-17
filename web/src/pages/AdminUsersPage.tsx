import { useEffect, useState } from 'react'
import { useAuth } from '@/store/useAuth'
import { Trash2, UserPlus } from 'lucide-react'

interface User {
  id: number
  username: string
  role: string
  createdAt: string
}

export function AdminUsersPage() {
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
    if (!confirm('Delete this user?')) return
    try {
      await fetch(`/api/v1/auth/users/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      fetchUsers()
    } catch {}
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold tracking-wider text-text-primary uppercase">Users</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1 px-2 py-1 text-[10px] text-accent hover:bg-accent-dim rounded transition-colors"
        >
          <UserPlus size={12} />
          Add User
        </button>
      </div>

      {showAdd && (
        <div className="border border-border rounded bg-surface p-3 space-y-2">
          <input
            type="text"
            value={newUser.username}
            onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
            placeholder="Username"
            className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <input
            type="password"
            value={newUser.password}
            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
            placeholder="Password"
            className="w-full bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
          />
          <div className="flex items-center gap-2">
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
              className="bg-surface-raised border border-border rounded px-2 py-1.5 text-xs text-text-primary focus:outline-none focus:border-accent"
            >
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
            <button
              onClick={handleAdd}
              className="px-3 py-1.5 bg-accent text-background rounded text-xs hover:bg-accent/90 transition-colors"
            >
              Create
            </button>
          </div>
        </div>
      )}

      <div className="border border-border rounded bg-surface overflow-hidden">
        {loading ? (
          <div className="p-4 text-xs text-text-muted">Loading...</div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="text-text-muted text-left border-b border-border bg-surface-raised">
                <th className="px-3 py-2 font-medium">Username</th>
                <th className="px-3 py-2 font-medium">Role</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border hover:bg-surface-raised transition-colors"
                >
                  <td className="px-3 py-2 text-text-primary">{u.username}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] ${
                        u.role === 'admin'
                          ? 'bg-accent-dim text-accent'
                          : 'bg-surface-raised text-text-muted'
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-text-muted">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-3 py-2 text-right">
                    {u.id !== currentUser?.id && (
                      <button
                        onClick={() => handleDelete(u.id)}
                        className="p-1 text-text-muted hover:text-danger transition-colors"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
