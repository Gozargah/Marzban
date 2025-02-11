import { Cpu, LucideIcon, Settings } from 'lucide-react'
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
  { id: 'general', label: 'general', icon: Settings, url: "/settings" },
  { id: 'core', label: 'core', icon: Cpu, url: "/settings/core" },
]

export default function Tabs() {
  const location = useLocation()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id)

  // Update activeTab when URL changes
  useEffect(() => {    
    const currentTab = tabs.find(tab => location.pathname === tab.url)    
    if (currentTab) {
      setActiveTab(currentTab.id)
    }
  }, [location.pathname])

  return (
    <div className="w-full">
      <div className="flex border-b">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => navigate(tab.url)}
            className={`relative px-3 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <div className='flex items-center gap-1.5'>
              <tab.icon className='h-4 w-4' />
              <span>{t(tab.label)}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="mt-4">
        <Outlet />
      </div>
    </div>
  )
}
