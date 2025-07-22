import PageHeader from '@/components/page-header'
import PageTransition from '@/components/PageTransition'
import { ArrowUpDown, Calendar, Lock, Users2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'

const tabs = [
  { id: 'groups', label: 'bulk.groups', icon: Users2, url: '/bulk' },
  { id: 'expire', label: 'bulk.expireDate', icon: Calendar, url: '/bulk/expire' },
  { id: 'data', label: 'bulk.dataLimit', icon: ArrowUpDown, url: '/bulk/data' },
  { id: 'proxy', label: 'bulk.proxySettings', icon: Lock, url: '/bulk/proxy' },
]

const BulkPage = () => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState(tabs[0].id)

  useEffect(() => {
    const currentTab = tabs.find(tab => location.pathname === tab.url)
    if (currentTab) {
      setActiveTab(currentTab.id)
    }
  }, [location.pathname])

  const getPageHeaderProps = () => {
    if (location.pathname === '/bulk/proxy') {
      return {
        title: 'bulk.proxySettings',
        description: 'bulk.proxySettingsDesc',
        buttonIcon: undefined,
        buttonText: undefined,
        onButtonClick: undefined,
      }
    }
    if (location.pathname === '/bulk/expire') {
      return {
        title: 'bulk.expireDate',
        description: 'bulk.expireDateDesc',
        buttonIcon: undefined,
        buttonText: undefined,
        onButtonClick: undefined,
      }
    }
    if (location.pathname === '/bulk/data') {
      return {
        title: 'bulk.dataLimit',
        description: 'bulk.dataLimitDesc',
        buttonIcon: undefined,
        buttonText: undefined,
        onButtonClick: undefined,
      }
    }
    return {
      title: 'bulk.groups',
      description: 'bulk.groupsDesc',
      buttonIcon: undefined,
      buttonText: undefined,
      onButtonClick: undefined,
    }
  }

  return (
    <div className="flex w-full flex-col items-start gap-0">
      <PageTransition isContentTransition={true}>
        <PageHeader {...getPageHeaderProps()} />
      </PageTransition>
      <div className="w-full">
        <div className="scrollbar-hide flex overflow-x-auto border-b px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.url)}
              className={`relative flex-shrink-0 whitespace-nowrap px-3 py-2 text-sm font-medium transition-colors ${activeTab === tab.id ? 'border-b-2 border-primary text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <div className="flex items-center gap-1.5">
                <tab.icon className="h-4 w-4" />
                <span>{t(tab.label)}</span>
              </div>
            </button>
          ))}
        </div>
        <div className="px-4">
          <PageTransition isContentTransition={true}>
            <Outlet />
          </PageTransition>
        </div>
      </div>
    </div>
  )
}

export default BulkPage
