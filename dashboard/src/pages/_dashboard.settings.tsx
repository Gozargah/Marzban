import PageHeader from '@/components/page-header'
import { LucideIcon, Palette, Bell, ListTodo, Webhook, MessageCircle, Send, Database } from 'lucide-react'
import { useEffect, useState, createContext, useContext } from 'react'
import { useTranslation } from 'react-i18next'
import { Outlet, useLocation, useNavigate } from 'react-router'
import { cn } from '@/lib/utils'
import { useGetSettings, useModifySettings } from '@/service/api'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'

interface Tab {
  id: string
  label: string
  icon: LucideIcon
  url: string
}

// Create context for settings
interface SettingsContextType {
  settings: any
  isLoading: boolean
  error: any
  updateSettings: (data: any) => void
  isSaving: boolean
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export const useSettingsContext = () => {
  const context = useContext(SettingsContext)
  if (!context) {
    throw new Error('useSettingsContext must be used within SettingsProvider')
  }
  return context
}

const tabs: Tab[] = [
  { id: 'notifications', label: 'settings.notifications.title', icon: Bell, url: '/settings/notifications' },
  { id: 'subscriptions', label: 'settings.subscriptions.title', icon: ListTodo, url: '/settings/subscriptions' },
  { id: 'telegram', label: 'settings.telegram.title', icon: Send, url: '/settings/telegram' },
  { id: 'discord', label: 'settings.discord.title', icon: MessageCircle, url: '/settings/discord' },
  { id: 'webhook', label: 'settings.webhook.title', icon: Webhook, url: '/settings/webhook' },
  { id: 'cleanup', label: 'settings.cleanup.title', icon: Database, url: '/settings/cleanup' },
  { id: 'theme', label: 'theme.title', icon: Palette, url: '/settings/theme' },
]

export default function Settings() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<string>('notifications')
  const queryClient = useQueryClient()

  // Fetch settings once at parent level
  const { data: settings, isLoading, error } = useGetSettings()
  const { mutate: updateSettings, isPending: isSaving } = useModifySettings({
    mutation: {
      onSuccess: () => {
        toast.success(t(`settings.${activeTab}.saveSuccess`))
        // Invalidate settings query to refresh with new data from API response
        queryClient.invalidateQueries({ queryKey: ['/api/settings'] })
      },
      onError: (error: any) => {
        // Extract validation errors from FetchError
        let errorMessage = t(`settings.${activeTab}.saveFailed`)

        // For FetchError from ofetch/nuxt
        if (error?.data?.detail) {
          const detail = error.data.detail

          // If detail is an object with field-specific errors
          if (typeof detail === 'object' && !Array.isArray(detail)) {
            const fieldErrors = Object.entries(detail).map(([field, message]) =>
              `${field}: ${message}`
            ).join(', ')
            errorMessage = fieldErrors
          }
          // If detail is a string
          else if (typeof detail === 'string') {
            errorMessage = detail
          }
          // If detail is an array of errors
          else if (Array.isArray(detail)) {
            errorMessage = detail.join(', ')
          }
        }
        // Fallback for other error structures
        else if (error?.response?.data?.detail) {
          const detail = error.response.data.detail
          if (typeof detail === 'object' && !Array.isArray(detail)) {
            const fieldErrors = Object.entries(detail).map(([field, message]) =>
              `${field}: ${message}`
            ).join(', ')
            errorMessage = fieldErrors
          } else if (typeof detail === 'string') {
            errorMessage = detail
          }
        }
        // Fallback to error message
        else if (error?.message) {
          errorMessage = error.message
        }

        toast.error(t(`settings.${activeTab}.saveFailed`), {
          description: errorMessage
        })
      }
    }
  })

  // Wrapper function to filter data based on active tab
  const handleUpdateSettings = (data: any) => {
    let filteredData: any = {}

    // Only include data relevant to the active tab
    switch (activeTab) {
      case 'notifications':
        if (data.data) {
          // If data is already wrapped, use it as is
          filteredData = data
        } else {
          // Wrap notification data in the expected format
          filteredData = {
            data: {
              notification_enable: data.notification_enable,
              notification_settings: data.notification_settings
            }
          }
        }
        break
      case 'subscriptions':
        if (data.subscription) {
          // Wrap subscription data in the expected format
          filteredData = {
            data: {
              subscription: data.subscription
            }
          }
        } else {
          // If data is already wrapped, use it as is
          filteredData = data
        }
        break
      case 'telegram':
        // Add telegram specific filtering if needed
        filteredData = { data: data }
        break
      case 'discord':
        // Add discord specific filtering if needed
        filteredData = { data: data }
        break
      case 'webhook':
        // Add webhook specific filtering if needed
        filteredData = { data: data }
        break
      case 'cleanup':
        // Add cleanup specific filtering if needed
        filteredData = { data: data }
        break
      case 'theme':
        // Add theme specific filtering if needed
        filteredData = { data: data }
        break
      default:
        filteredData = { data: data }
    }

    updateSettings(filteredData)
  }

  useEffect(() => {
    // If we're on the base /settings route, redirect to notification
    if (location.pathname === '/settings') {
      navigate('/settings/notifications', { replace: true })
      return
    }

    const currentTab = tabs.find(tab => location.pathname === tab.url)
    if (currentTab && currentTab.id !== activeTab) {
      setActiveTab(currentTab.id)
    }
  }, [location.pathname, navigate, activeTab])

  const settingsContextValue: SettingsContextType = {
    settings,
    isLoading,
    error,
    updateSettings: handleUpdateSettings,
    isSaving
  }

  return (
    <SettingsContext.Provider value={settingsContextValue}>
      <div className="flex flex-col gap-0 w-full items-start">
        <PageHeader title={t(`settings.${activeTab}.title`)} description="manageSettings" />

        <div className="w-full relative">
          <div className="flex border-b">
            <div className="w-full">
              <div className="flex border-b px-4 overflow-x-auto scrollbar-hide">
                {tabs.map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      if (location.pathname !== tab.url) {
                        navigate(tab.url)
                      }
                    }}
                    className={cn(
                      'relative px-3 py-2 text-sm font-medium transition-colors whitespace-nowrap flex-shrink-0',
                      activeTab === tab.id
                        ? 'text-foreground border-b-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <tab.icon className="h-4 w-4" />
                      <span>{t(tab.label)}</span>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                <Outlet />
              </div>
            </div>
          </div>
        </div>
      </div>
    </SettingsContext.Provider>
  )
}
