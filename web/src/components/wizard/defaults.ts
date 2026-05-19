import type { WizardData } from './types'

export const defaultWizardData: WizardData = {
  container: {
    image: '',
    exec: '',
    ports: [],
    volumes: [],
    env: [],
    labels: {},
    user: '',
    group: '',
    hostName: '',
    network: '',
    autoUpdate: '',
    healthCheck: {
      enabled: false,
      cmd: '',
      interval: '10s',
      retries: 3,
      startPeriod: '60s',
      timeout: '5s',
    },
  },
  unit: {
    description: '',
    after: [],
    requires: [],
    wants: [],
  },
  service: {
    restart: 'always',
    timeoutStartSec: '300',
    waitForPaths: [],
    execStartPre: [],
    execStartPost: [],
  },
}
