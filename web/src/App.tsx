import { useEffect } from 'react'
import { RouterProvider } from 'react-router'
import { router } from '@/router'
import { useAuth } from '@/store/useAuth'
import { useApp } from '@/store/useApp'
import { useUnits } from '@/store/useUnits'
import { useContainers } from '@/store/useContainers'
import { useWebSocket } from '@/hooks/useWebSocket'
import { toast } from 'sonner'

export default function App() {
  const { token, checkInit, fetchMe } = useAuth()
  const fetchSystemInfo = useApp((s) => s.fetchSystemInfo)
  const fetchUnits = useUnits((s) => s.fetchUnits)
  const fetchContainers = useContainers((s) => s.fetchContainers)

  useEffect(() => {
    checkInit()
  }, [checkInit])

  useEffect(() => {
    if (token) {
      fetchMe()
      fetchSystemInfo()
      fetchUnits()
      fetchContainers()
    }
  }, [token, fetchMe, fetchSystemInfo, fetchUnits, fetchContainers])

  useWebSocket((msg) => {
    if (msg.type === 'unit_status_changed' || msg.type === 'daemon_reloaded') {
      fetchUnits()
    }
    if (msg.type === 'stats_update') {
      fetchContainers()
    }
    if (msg.type === 'unit_failed') {
      const data = msg.data as { name?: string }
      toast.error(`Unit failed: ${data?.name || 'unknown'}`)
    }
  })

  return <RouterProvider router={router} />
}
