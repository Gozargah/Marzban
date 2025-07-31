import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetUserSubUpdateList, UserSubscriptionUpdateSchema } from '@/service/api'
import { parseUserAgent, formatClientInfo } from '@/utils/userAgentParser'
import { dateUtils } from '@/utils/dateFormatter'
import { Monitor, Smartphone, Globe, HelpCircle, Users, Loader2 } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'
import useDirDetection from '@/hooks/use-dir-detection'

interface UserSubscriptionClientsModalProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  username: string
}

// Function to format time ago
const formatTimeAgo = (timestamp: number, t: (key: string, options?: Record<string, unknown>) => string): string => {
  const currentTime = dayjs()
  const pastTime = dateUtils.toDayjs(timestamp)
  const diffInSeconds = currentTime.diff(pastTime, 'seconds')

  if (diffInSeconds <= 60) {
    return t('justNow', { defaultValue: 'Just now' })
  }

  const duration = dayjs.duration(diffInSeconds, 'seconds')
  let timeText = ''

  if (duration.years() > 0) {
    timeText = `${duration.years()} ${t(`time.${duration.years() !== 1 ? 'years' : 'year'}`)} ${t('time.ago')}`
  } else if (duration.months() > 0) {
    timeText = `${duration.months()} ${t(`time.${duration.months() !== 1 ? 'months' : 'month'}`)} ${t('time.ago')}`
  } else if (duration.days() > 0) {
    timeText = `${duration.days()} ${t(`time.${duration.days() !== 1 ? 'days' : 'day'}`)} ${t('time.ago')}`
  } else if (duration.hours() > 0) {
    timeText = `${duration.hours()} ${t(`time.${duration.hours() !== 1 ? 'hours' : 'hour'}`)} ${t('time.ago')}`
  } else if (duration.minutes() > 0) {
    timeText = `${duration.minutes()} ${t(`time.${duration.minutes() !== 1 ? 'mins' : 'min'}`)} ${t('time.ago')}`
  } else {
    timeText = `${duration.seconds()} ${t(`time.${duration.seconds() !== 1 ? 'seconds' : 'second'}`)} ${t('time.ago')}`
  }

  return timeText
}

// Get the appropriate icon for the client type
const getClientIcon = (iconType: string) => {
  switch (iconType) {
    case 'desktop':
      return Monitor
    case 'mobile':
      return Smartphone
    case 'browser':
      return Globe
    default:
      return HelpCircle
  }
}

// Get OS badge color
const getOSBadgeColor = (os: string) => {
  switch (os.toLowerCase()) {
    case 'windows':
      return 'bg-blue-500 hover:bg-blue-600'
    case 'mac':
    case 'macos':
      return 'bg-gray-500 hover:bg-gray-600'
    case 'android':
      return 'bg-green-500 hover:bg-green-600'
    case 'ios':
      return 'bg-purple-500 hover:bg-purple-600'
    case 'linux':
      return 'bg-orange-500 hover:bg-orange-600'
    case 'ubuntu':
      return 'bg-orange-600 hover:bg-orange-700'
    case 'debian':
      return 'bg-red-500 hover:bg-red-600'
    case 'centos':
      return 'bg-purple-600 hover:bg-purple-700'
    case 'fedora':
      return 'bg-blue-600 hover:bg-blue-700'
    case 'arch':
      return 'bg-blue-700 hover:bg-blue-800'
    default:
      return 'bg-gray-400 hover:bg-gray-500'
  }
}

// Improved OS detection from user agent
const detectOS = (userAgent: string): string => {
  const ua = userAgent.toLowerCase()
  
  // iOS detection (including CFNetwork and Darwin)
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod') || 
      ua.includes('cfnetwork') || ua.includes('darwin')) return 'iOS'
  
  if (ua.includes('windows')) return 'Windows'
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'Mac'
  if (ua.includes('android')) return 'Android'
  if (ua.includes('linux')) return 'Linux'
  if (ua.includes('ubuntu')) return 'Ubuntu'
  if (ua.includes('debian')) return 'Debian'
  if (ua.includes('centos')) return 'CentOS'
  if (ua.includes('fedora')) return 'Fedora'
  if (ua.includes('arch')) return 'Arch'
  
  return 'Unknown'
}

// Improved version detection from user agent
const detectVersion = (userAgent: string): string => {
  const ua = userAgent
  
  // Try to find version patterns
  const patterns = [
    /(?:v|version|ver)\s*(\d+\.\d+\.\d+)/i,
    /(\d+\.\d+\.\d+)/,
    /(?:v|version|ver)\s*(\d+\.\d+)/i,
    /(\d+\.\d+)/,
    /(?:v|version|ver)\s*(\d+)/i,
    /(\d+)/
  ]
  
  for (const pattern of patterns) {
    const match = ua.match(pattern)
    if (match && match[1]) {
      // For iOS CFNetwork, extract the app version (first number)
      if (ua.includes('cfnetwork')) {
        const appVersionMatch = ua.match(/^([^\/]+)\/(\d+)/i)
        if (appVersionMatch && appVersionMatch[2]) {
          return appVersionMatch[2]
        }
      }
      return match[1]
    }
  }
  
  // Special handling for CFNetwork format
  if (ua.includes('cfnetwork')) {
    const appVersionMatch = ua.match(/^([^\/]+)\/(\d+)/i)
    if (appVersionMatch && appVersionMatch[2]) {
      return appVersionMatch[2]
    }
  }
  
  return 'Unknown'
}

export const UserSubscriptionClientsModal: FC<UserSubscriptionClientsModalProps> = ({
  isOpen,
  onOpenChange,
  username
}) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  const {
    data: subUpdateList,
    isLoading,
    error,
  } = useGetUserSubUpdateList(
    username,
    { offset: 0, limit: 50 }, // Get last 50 clients
    {
      query: {
        enabled: isOpen && !!username,
      },
    },
  )

  const renderClientCard = (update: UserSubscriptionUpdateSchema, index: number) => {
    const clientInfo = parseUserAgent(update.user_agent)
    const formattedClient = formatClientInfo(clientInfo)
    const ClientIcon = getClientIcon(clientInfo.iconType)

    // Convert created_at to timestamp if it's a string
    let timestamp: number | null = null
    if (update.created_at) {
      if (typeof update.created_at === 'string') {
        const date = new Date(update.created_at)
        timestamp = Math.floor(date.getTime() / 1000)
      } else if (typeof update.created_at === 'number') {
        timestamp = update.created_at
      }
    }

    const timeAgo = timestamp ? formatTimeAgo(timestamp, t) : null

    // Extract version and OS from user agent
    const version = detectVersion(update.user_agent)
    const os = detectOS(update.user_agent)

    return (
      <div key={index} className="rounded-lg border bg-card p-4 hover:bg-accent/50 transition-colors" dir={dir}>
        <div className={`flex items-start justify-between mb-3 ${dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
          <div className={`flex items-center gap-2 ${dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
            <ClientIcon className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-sm" dir="ltr">{formattedClient}</span>
          </div>
          <span dir={dir} className="text-xs text-muted-foreground whitespace-nowrap">
            {timeAgo || t('subscriptionClients.unknown', { defaultValue: 'Unknown' })}
          </span>
        </div>
        
        <div className="flex gap-2">
          <Badge variant="secondary" className="text-xs bg-orange-500 hover:bg-orange-600 text-white">
            v{version}
          </Badge>
          <Badge variant="secondary" className={`text-xs text-white ${getOSBadgeColor(os)}`}>
            {os}
          </Badge>
        </div>

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <p className="cursor-help truncate text-xs text-muted-foreground mt-2" dir="ltr">
                {update.user_agent}
              </p>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p className="break-all text-xs" dir="ltr">{update.user_agent}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-w-4xl flex-col p-6" dir={dir}>
        <DialogHeader>
          <DialogTitle className={`flex items-center gap-2`}>
            <Users className="h-5 w-5 flex-shrink-0" />
            <span>{t('subscriptionClients.title', { defaultValue: 'Subscription Clients' })}</span>
            <Badge variant="outline" dir="ltr" className="flex-shrink-0">{username}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex w-full flex-col gap-4">
          {isLoading && (
            <div className={`flex items-center justify-center py-8 ${dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Loader2 className="h-6 w-6 animate-spin flex-shrink-0" />
              <span className={`${dir === 'rtl' ? 'mr-2' : 'ml-2'}`}>{t('loading', { defaultValue: 'Loading...' })}</span>
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-destructive">
              {t('subscriptionClients.error', { defaultValue: 'Failed to load subscription clients' })}
            </div>
          )}

          {!isLoading && !error && subUpdateList && (
            <>
              <div className={`flex items-center justify-between ${dir === 'rtl' ? 'flex-row-reverse' : 'flex-row'}`}>
                <span className="text-sm text-muted-foreground">
                  {t('subscriptionClients.total', {
                    defaultValue: 'Total: {{count}} clients',
                    count: subUpdateList.count,
                  })}
                </span>
                {subUpdateList.updates && subUpdateList.updates.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t('subscriptionClients.showing', {
                      defaultValue: 'Showing last {{count}} accesses',
                      count: subUpdateList.updates.length,
                    })}
                  </span>
                )}
              </div>

              <ScrollArea className="flex h-[500px] rounded-lg border p-4">
                {subUpdateList.updates && subUpdateList.updates.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {subUpdateList.updates.map((update, index) => renderClientCard(update, index))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <div className="text-center">
                      <Users className="mx-auto mb-2 h-12 w-12 opacity-50" />
                      <p className="text-sm">
                        {t('subscriptionClients.noClients', {
                          defaultValue: 'No subscription clients found',
                        })}
                      </p>
                      <p className="mt-1 text-xs">
                        {t('subscriptionClients.noClientsDesc', {
                          defaultValue: 'This user has not accessed their subscription yet',
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          <div className={`flex ${dir === 'rtl' ? 'justify-start' : 'justify-end'}`}>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close', { defaultValue: 'Close' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
