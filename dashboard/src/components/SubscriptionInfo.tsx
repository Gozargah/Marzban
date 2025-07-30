import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { parseUserAgent, formatClientInfo } from '@/utils/userAgentParser'
import { dateUtils } from '@/utils/dateFormatter'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Clock, Monitor, Smartphone, Globe, HelpCircle } from 'lucide-react'
import dayjs from '@/lib/dayjs'

interface SubscriptionInfoProps {
  subUpdatedAt?: string | null
  subLastUserAgent?: string | null
  compact?: boolean
  headerButton?: React.ReactNode
}

const convertDateFormat = (dateValue: string | null | undefined): number | null => {
  if (!dateValue) return null

  // If it's already a timestamp, return it
  if (!isNaN(Number(dateValue))) {
    return Number(dateValue)
  }

  // Handle string values
  if (typeof dateValue === 'string') {
    try {
      // Use the same dateUtils.toDayjs logic as other components for consistency
      const dayjsDate = dateUtils.toDayjs(dateValue)
      if (dayjsDate.isValid()) {
        return dayjsDate.unix()
      }
    } catch (error) {
      // If dayjs parsing fails, try direct Date parsing as fallback
      const date = new Date(dateValue)
      if (!isNaN(date.getTime())) {
        return Math.floor(date.getTime() / 1000)
      }
    }
  }

  return null
}

// Function to format time ago, similar to OnlineBadge
const formatTimeAgo = (timestamp: number, t: any): string => {
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

export const SubscriptionInfo: FC<SubscriptionInfoProps> = ({ subUpdatedAt, subLastUserAgent, compact = false, headerButton }) => {
  const { t } = useTranslation()

  const unixTime = convertDateFormat(subUpdatedAt)
  const timeAgo = unixTime ? formatTimeAgo(unixTime, t) : null
  const clientInfo = parseUserAgent(subLastUserAgent)
  const formattedClient = formatClientInfo(clientInfo)

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

  const ClientIcon = getClientIcon(clientInfo.iconType)

  if (compact) {
    return (
      <div className="flex flex-col gap-1 text-xs text-muted-foreground">
        {subUpdatedAt && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span>{timeAgo || t('userDialog.subscriptionNotAccessed')}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  {t('userDialog.subscriptionUpdated')}: {subUpdatedAt ? dateUtils.formatDate(subUpdatedAt) : t('userDialog.subscriptionNotAccessed')}
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}

        {subLastUserAgent && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="flex items-center gap-1">
                  <ClientIcon className="h-3 w-3" />
                  <span className={clientInfo.isKnownClient ? 'text-green-600 dark:text-green-400' : ''}>{formattedClient}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent>
                <div className="max-w-xs">
                  <p className="mb-1 font-medium">{t('userDialog.lastClient')}:</p>
                  <p className="break-all text-xs">{subLastUserAgent}</p>
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-primary" />
          <label className="text-sm font-medium">{t('userDialog.subscriptionInfo')}</label>
        </div>
        {headerButton && <div className="flex-shrink-0">{headerButton}</div>}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {subUpdatedAt && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('userDialog.subscriptionUpdated')}</span>
            <div className="text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help transition-colors hover:text-primary">{timeAgo || t('userDialog.subscriptionNotAccessed')}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{subUpdatedAt ? dateUtils.formatDate(subUpdatedAt) : t('userDialog.subscriptionNotAccessed')}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}

        {subLastUserAgent && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('userDialog.lastClient')}</span>
            <div className="text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex cursor-help items-center gap-2 transition-colors hover:text-primary">
                      <ClientIcon className="h-4 w-4" />
                      <span className={`${clientInfo.isKnownClient ? 'font-medium text-green-600 dark:text-green-400' : ''}`}>{formattedClient}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="max-w-xs">
                      <p className="break-all text-xs">{subLastUserAgent}</p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        )}
      </div>
    </div>
  )
} 