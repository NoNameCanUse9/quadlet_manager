import { createBrowserRouter, Navigate } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { AuthGuard } from '@/components/AuthGuard'
import { LoginPage } from '@/pages/LoginPage'
import { InitPage } from '@/pages/InitPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { UnitsPage } from '@/pages/UnitsPage'
import { ContainersPage } from '@/pages/ContainersPage'
import { ImagesPage } from '@/pages/ImagesPage'
import { VolumesPage } from '@/pages/VolumesPage'
import { NetworksPage } from '@/pages/NetworksPage'
import { FilesPage } from '@/pages/FilesPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/init', element: <InitPage /> },
  {
    path: '/',
    element: (
      <AuthGuard>
        <AppLayout />
      </AuthGuard>
    ),
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'containers', element: <ContainersPage /> },
      { path: 'images', element: <ImagesPage /> },
      { path: 'volumes', element: <VolumesPage /> },
      { path: 'networks', element: <NetworksPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'settings', element: <SettingsPage /> },
      { path: 'admin/users', element: <AdminUsersPage /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])
