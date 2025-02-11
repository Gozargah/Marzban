import PageHeader from '@/components/page-header'
import { Boxes, UserCog } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'

const tabs = [
  { id: 'user-templates', label: 'templates.userTemplates', icon: UserCog, url: '/templates' },
  { id: 'core', label: 'templates.groupTemplates', icon: Boxes, url: '/templates/group' },
]

const Templates = () => {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>(tabs[0].id)
  useEffect(() => {
    const currentTab = tabs.find(tab => location.pathname === tab.url)
    if (currentTab) {
      setActiveTab(currentTab.id)
    }
  }, [location.pathname])
  return (
    <div className="flex flex-col gap-0 w-full items-start">
      <PageHeader title="templates.title" description="createAndManageTemplates" />
      <div className="w-full">
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
      </div>
    </div>
  )
}

export default Templates
