import { useEffect } from 'react'
import { Navigate } from 'react-router'
import { useAuth } from '@/store/useAuth'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, initialized, checkInit, fetchMe } = useAuth()

  useEffect(() => {
    if (initialized === null) checkInit()
    if (token) fetchMe()
  }, [initialized, token, checkInit, fetchMe])

  if (initialized === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size={24} />
      </div>
    )
  }

  if (!initialized) return <Navigate to="/init" replace />
  if (!token) return <Navigate to="/login" replace />

  return <>{children}</>
}
