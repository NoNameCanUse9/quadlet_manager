import { createBrowserRouter } from 'react-router'
import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { UnitsPage } from '@/pages/UnitsPage'
import { ContainersPage } from '@/pages/ContainersPage'
import { ImagesPage } from '@/pages/ImagesPage'
import { VolumesPage } from '@/pages/VolumesPage'
import { NetworksPage } from '@/pages/NetworksPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { FilesPage } from '@/pages/FilesPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: 'units', element: <UnitsPage /> },
      { path: 'containers', element: <ContainersPage /> },
      { path: 'images', element: <ImagesPage /> },
      { path: 'volumes', element: <VolumesPage /> },
      { path: 'networks', element: <NetworksPage /> },
      { path: 'files', element: <FilesPage /> },
      { path: 'settings', element: <SettingsPage /> },
    ],
  },
])
