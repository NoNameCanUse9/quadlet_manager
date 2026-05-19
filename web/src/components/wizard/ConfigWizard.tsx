import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import type { WizardData } from './types'
import { defaultWizardData } from './defaults'
import { wizardToQuadlet, quadletToWizard } from './convert'
import { GeneralPanel } from './panels/GeneralPanel'
import { UnitPanel } from './panels/UnitPanel'
import { ServicePanel } from './panels/ServicePanel'
import { CodePreview } from './CodePreview'

export { wizardToQuadlet, quadletToWizard, defaultWizardData }
export type { WizardData }

interface ConfigWizardProps {
  value: WizardData
  onChange: (data: WizardData) => void
}

export function ConfigWizard({ value, onChange }: ConfigWizardProps) {
  const { t } = useTranslation()
  const data = value

  const updateContainer = useCallback(
    (patch: Partial<WizardData['container']>) => {
      onChange({ ...data, container: { ...data.container, ...patch } })
    },
    [data, onChange]
  )

  const updateUnit = useCallback(
    (patch: Partial<WizardData['unit']>) => {
      onChange({ ...data, unit: { ...data.unit, ...patch } })
    },
    [data, onChange]
  )

  const updateService = useCallback(
    (patch: Partial<WizardData['service']>) => {
      onChange({ ...data, service: { ...data.service, ...patch } })
    },
    [data, onChange]
  )

  const hasImage = data.container.image.trim().length > 0
  const preview = wizardToQuadlet(data)

  return (
    <div className="flex flex-col md:flex-row gap-3 h-full min-h-0">
      {/* Left: Tabs */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <Tabs defaultValue="general">
          <TabsList>
            <TabsTrigger value="general">
              {t('wizard.tabs.general')}
              {!hasImage && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-danger" />
              )}
            </TabsTrigger>
            <TabsTrigger value="unit">{t('wizard.tabs.unit')}</TabsTrigger>
            <TabsTrigger value="service">{t('wizard.tabs.service')}</TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <GeneralPanel data={data.container} onChange={updateContainer} />
          </TabsContent>
          <TabsContent value="unit">
            <UnitPanel data={data.unit} onChange={updateUnit} />
          </TabsContent>
          <TabsContent value="service">
            <ServicePanel data={data.service} onChange={updateService} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Right: Code Preview */}
      <div className="w-full md:w-2/5 border border-border rounded-lg overflow-hidden min-h-[200px] md:min-h-0">
        <CodePreview content={preview} />
      </div>
    </div>
  )
}
