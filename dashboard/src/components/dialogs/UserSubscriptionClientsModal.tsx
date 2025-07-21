import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useGetUserSubUpdateList, UserSubscriptionUpdateSchema } from '@/service/api'
import { parseUserAgent, formatClientInfo } from '@/utils/userAgentParser'
import { dateUtils } from '@/utils/dateFormatter'
import { Clock, Monitor, Smartphone, Globe, HelpCircle, Users, Loader2 } from 'lucide-react'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'

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

export const UserSubscriptionClientsModal: FC<UserSubscriptionClientsModalProps> = ({
  isOpen,
  onOpenChange,
  username
}) => {
  const { t } = useTranslation()

  const { data: subUpdateList, isLoading, error } = useGetUserSubUpdateList(
    username,
    { offset: 0, limit: 50 }, // Get last 50 clients
    {
      query: {
        enabled: isOpen && !!username,
      }
    }
  )

  console.log('subUpdateList', subUpdateList);
  

  const renderClientItem = (update: UserSubscriptionUpdateSchema, index: number) => {
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

    return (
      <div key={index} className="flex items-center justify-between p-4 border-b border-border last:border-b-0">
        <div className="flex items-center gap-3 flex-1">
          <ClientIcon className="h-5 w-5 text-muted-foreground" />
          <div className="flex-1 max-w-[200px]">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-sm font-medium ${clientInfo.isKnownClient ? 'text-green-600 dark:text-green-400' : ''}`}>
                {formattedClient}
              </span>
              {clientInfo.isKnownClient && (
                <Badge variant="secondary" className="text-xs">
                  {t('subscriptionClients.knownClient', { defaultValue: 'Known' })}
                </Badge>
              )}
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <p className="text-xs text-muted-foreground truncate cursor-help">
                    {update.user_agent}
                  </p>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="text-xs break-all">{update.user_agent}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help">
                  {timeAgo || t('subscriptionClients.unknown', { defaultValue: 'Unknown' })}
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {update.created_at 
                    ? dateUtils.formatDate(update.created_at) 
                    : t('subscriptionClients.unknown', { defaultValue: 'Unknown' })
                  }
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    )
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="flex flex-col max-w-3xl p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {t('subscriptionClients.title', { defaultValue: 'Subscription Clients' })}
            <Badge variant="outline">{username}</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4 w-full">
          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">{t('loading', { defaultValue: 'Loading...' })}</span>
            </div>
          )}

          {error && (
            <div className="text-center py-8 text-destructive">
              {t('subscriptionClients.error', { defaultValue: 'Failed to load subscription clients' })}
            </div>
          )}

          {!isLoading && !error && subUpdateList && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {t('subscriptionClients.total', { 
                    defaultValue: 'Total: {{count}} clients', 
                    count: subUpdateList.count 
                  })}
                </span>
                {subUpdateList.updates && subUpdateList.updates.length > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {t('subscriptionClients.showing', { 
                      defaultValue: 'Showing last {{count}} accesses',
                      count: subUpdateList.updates.length
                    })}
                  </span>
                )}
              </div>

              <ScrollArea className="h-[400px] flex border rounded-lg">
                {subUpdateList.updates && subUpdateList.updates.length > 0 ? (
                  <div className="divide-y">
                    {subUpdateList.updates.map((update, index) => renderClientItem(update, index))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center py-8 text-muted-foreground">
                    <div className="text-center">
                      <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {t('subscriptionClients.noClients', { 
                          defaultValue: 'No subscription clients found' 
                        })}
                      </p>
                      <p className="text-xs mt-1">
                        {t('subscriptionClients.noClientsDesc', { 
                          defaultValue: 'This user has not accessed their subscription yet' 
                        })}
                      </p>
                    </div>
                  </div>
                )}
              </ScrollArea>
            </>
          )}

          <div className="flex justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('close', { defaultValue: 'Close' })}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
