import PageHeader from '@/components/page-header'
import PageTransition from '@/components/PageTransition'
import { Users2, Lock, Calendar, ArrowUpDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useLocation, Outlet } from 'react-router'
import { useEffect, useState } from 'react'

const tabs = [
  { id: 'groups', label: 'bulk.groups', icon: Users2, url: '/bulk' },
  { id: 'proxy', label: 'bulk.proxySettings', icon: Lock, url: '/bulk/proxy' },
  { id: 'expire', label: 'bulk.expireDate', icon: Calendar, url: '/bulk/expire' },
  { id: 'data', label: 'bulk.dataLimit', icon: ArrowUpDown, url: '/bulk/data' },
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
    <div className="flex flex-col gap-0 w-full items-start">
      <PageTransition isContentTransition={true}>
        <PageHeader {...getPageHeaderProps()} />
      </PageTransition>
      <div className="w-full">
        <div className="flex border-b px-4 overflow-x-auto scrollbar-hide">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => navigate(tab.url)}
              className={`relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0 ${activeTab === tab.id ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'}`}
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