import Tabs from '@/components/Tabs'
import { Cpu, Settings as SettingsIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const Settings = () => {
  const { t } = useTranslation()
  const tabs = [
    { id: 'general', label: 'general', icon: SettingsIcon, url: "/settings" },
    { id: 'core', label: 'core', icon: Cpu, url: "/settings/core" },
  ]
  return (
    <div className='p-4'>
      <div className="flex flex-col gap-y-2 mb-4">
        <h1 className="font-semibold text-2xl sm:text-3xl">{t('settings')}</h1>
        <span className="text-muted-foreground text-xs sm:text-sm">{t('manageNodes')}</span>
      </div>
      <div>
        <Tabs tabs={tabs} />
      </div>
    </div>
  )
}

export default Settings
