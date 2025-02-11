import Tabs from '@/components/Tabs'
import { useTranslation } from 'react-i18next'

const Settings = () => {
  const { t } = useTranslation()
  return (
    <div className='p-4'>
      <div className="flex flex-col gap-y-2 mb-4">
        <h1 className="font-semibold text-2xl sm:text-3xl">{t('settings')}</h1>
        <span className="text-muted-foreground text-xs sm:text-sm">{t('manageNodes')}</span>
      </div>
      <div>
        <Tabs />
      </div>
    </div>
  )
}

export default Settings
