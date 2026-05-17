import { create } from 'zustand'

interface User {
  id: number
  username: string
  role: string
}

interface AuthState {
  token: string | null
  user: User | null
  initialized: boolean | null
  loading: boolean
  error: string | null
  checkInit: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  initAdmin: (username: string, password: string) => Promise<void>
  logout: () => void
  fetchMe: () => Promise<void>
}

export const useAuth = create<AuthState>((set, get) => ({
  token: localStorage.getItem('token'),
  user: null,
  initialized: null,
  loading: false,
  error: null,

  checkInit: async () => {
    try {
      const res = await fetch('/api/v1/auth/init')
      const data = await res.json()
      set({ initialized: data.initialized })
    } catch {
      set({ initialized: false })
    }
  },

  login: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Invalid credentials')
      }
      const data = await res.json()
      localStorage.setItem('token', data.token)
      set({ token: data.token, user: data.user, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  initAdmin: async (username, password) => {
    set({ loading: true, error: null })
    try {
      const res = await fetch('/api/v1/auth/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Init failed')
      }
      const data = await res.json()
      localStorage.setItem('token', data.token)
      set({ token: data.token, user: data.user, initialized: true, loading: false })
    } catch (e) {
      set({ error: (e as Error).message, loading: false })
      throw e
    }
  },

  logout: () => {
    localStorage.removeItem('token')
    set({ token: null, user: null })
  },

  fetchMe: async () => {
    const token = get().token
    if (!token) return
    try {
      const res = await fetch('/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        get().logout()
        return
      }
      const data = await res.json()
      set({ user: data.user })
    } catch {
      get().logout()
    }
  },
}))
