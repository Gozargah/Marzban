import PageHeader from '@/components/page-header'
import { LucideIcon, Settings as SettingsIcon, Palette, Construction } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  url: string
}

const tabs: Tab[] = [
  { id: 'general', label: 'general', icon: SettingsIcon, url: '/settings' },
  { id: 'theme', label: 'theme.title', icon: Palette, url: '/settings/theme' },
]

const Settings = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id)

  useEffect(() => {
    const currentTab = tabs.find(tab => location.pathname === tab.url)
    if (currentTab) {
      setActiveTab(currentTab.id)
    }
  }, [location.pathname])

  return (
      <div className="flex flex-col gap-0 w-full items-start">
        <PageHeader title="settings" description="manageSettings" />

        <div className="w-full relative">
          <div className="flex border-b px-4">
            {tabs.map(tab => (
                <button
                    key={tab.id}
                    onClick={() => navigate(tab.url)}
                    className={`relative px-3 py-2 text-sm font-medium transition-colors ${
                        activeTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
                    }`}
                >
                  <div className="flex items-center gap-1.5">
                    <tab.icon className="h-4 w-4" />
                    <span>{t(tab.label)}</span>
                  </div>
                </button>
            ))}
          </div>
          <div className="px-4">
            <Outlet />
          </div>

          {/* Under Development Overlay */}
          <div className="absolute inset-0 bg-black/20 backdrop-blur-[2px] flex flex-col items-center z-10">
            <div className="bg-background/90 border-2 border-amber-400 dark:border-amber-600 shadow-md rounded-md p-4 max-w-md sm:max-w-lg md:max-w-xl mt-6 mx-auto flex flex-col items-center gap-3">
              <Construction className="h-16 w-16 sm:h-20 sm:w-20 text-amber-500 animate-pulse" />
              <div>
                <h2 className="text-lg font-bold text-foreground">{t("underDevelopment.title")}</h2>
                <p className="text-sm text-muted-foreground">{t("underDevelopment.description")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
  )
}

export default Settings
