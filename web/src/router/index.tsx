import { lazy, Suspense } from 'react'
import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/AuthGuard'
import { ErrorBoundary } from '@/components/ErrorBoundary'

const LoginPage = lazy(() => import('@/pages/LoginPage').then(m => ({ default: m.LoginPage })))
const InitPage = lazy(() => import('@/pages/InitPage').then(m => ({ default: m.InitPage })))
const DashboardPage = lazy(() => import('@/pages/DashboardPage').then(m => ({ default: m.DashboardPage })))
const UnitsPage = lazy(() => import('@/pages/UnitsPage').then(m => ({ default: m.UnitsPage })))
const ContainersPage = lazy(() => import('@/pages/ContainersPage').then(m => ({ default: m.ContainersPage })))
const ImagesPage = lazy(() => import('@/pages/ImagesPage').then(m => ({ default: m.ImagesPage })))
const VolumesPage = lazy(() => import('@/pages/VolumesPage').then(m => ({ default: m.VolumesPage })))
const NetworksPage = lazy(() => import('@/pages/NetworksPage').then(m => ({ default: m.NetworksPage })))
const FilesPage = lazy(() => import('@/pages/FilesPage').then(m => ({ default: m.FilesPage })))
const SettingsPage = lazy(() => import('@/pages/SettingsPage').then(m => ({ default: m.SettingsPage })))
const AdminUsersPage = lazy(() => import('@/pages/AdminUsersPage').then(m => ({ default: m.AdminUsersPage })))
const TerminalPage = lazy(() => import('@/pages/TerminalPage').then(m => ({ default: m.TerminalPage })))
const BackupPage = lazy(() => import('@/pages/BackupPage').then(m => ({ default: m.BackupPage })))

function SuspenseWrapper({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<div className="p-4 text-xs text-text-muted">Loading...</div>}>
        {children}
      </Suspense>
    </ErrorBoundary>
  )
}

export const router = createBrowserRouter([
  { path: '/login', element: <SuspenseWrapper><LoginPage /></SuspenseWrapper> },
  { path: '/init', element: <SuspenseWrapper><InitPage /></SuspenseWrapper> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <SuspenseWrapper><DashboardPage /></SuspenseWrapper> },
      { path: 'units', element: <SuspenseWrapper><UnitsPage /></SuspenseWrapper> },
      { path: 'containers', element: <SuspenseWrapper><ContainersPage /></SuspenseWrapper> },
      { path: 'images', element: <SuspenseWrapper><ImagesPage /></SuspenseWrapper> },
      { path: 'volumes', element: <SuspenseWrapper><VolumesPage /></SuspenseWrapper> },
      { path: 'networks', element: <SuspenseWrapper><NetworksPage /></SuspenseWrapper> },
      { path: 'files', element: <SuspenseWrapper><FilesPage /></SuspenseWrapper> },
      { path: 'settings', element: <SuspenseWrapper><SettingsPage /></SuspenseWrapper> },
      { path: 'admin/users', element: <SuspenseWrapper><AdminUsersPage /></SuspenseWrapper> },
      { path: 'containers/:id/exec/:exec_id', element: <SuspenseWrapper><TerminalPage /></SuspenseWrapper> },
      { path: 'backup', element: <SuspenseWrapper><BackupPage /></SuspenseWrapper> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
