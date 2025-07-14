import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { parseUserAgent, formatClientInfo } from '@/utils/userAgentParser'
import { useRelativeExpiryDate, dateUtils } from '@/utils/dateFormatter'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Clock, Monitor, Smartphone, Globe, HelpCircle } from 'lucide-react'

interface SubscriptionInfoProps {
  subUpdatedAt?: string | null
  subLastUserAgent?: string | null
  compact?: boolean
}

const convertDateFormat = (dateValue: string | null | undefined): number | null => {
  if (!dateValue) return null

  // If it's already a timestamp, return it
  if (!isNaN(Number(dateValue))) {
    return Number(dateValue)
  }

  // Handle string values
  if (typeof dateValue === 'string') {
    // For any string format, try to parse it as a date
    const date = new Date(dateValue)
    if (!isNaN(date.getTime())) {
      return Math.floor(date.getTime() / 1000)
    }
  }

  return null
}

export const SubscriptionInfo: FC<SubscriptionInfoProps> = ({ subUpdatedAt, subLastUserAgent, compact = false }) => {
  const { t } = useTranslation()

  // Don't render anything if both values are null/undefined
  if (!subUpdatedAt && !subLastUserAgent) {
    return null
  }

  const unixTime = convertDateFormat(subUpdatedAt)
  const dateInfo = unixTime ? useRelativeExpiryDate(unixTime) : null
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
                  <span>{dateInfo?.time || t('userDialog.subscriptionNotAccessed')}</span>
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
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 text-primary" />
        <label className="text-sm font-medium">{t('userDialog.subscriptionInfo')}</label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {subUpdatedAt && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted-foreground">{t('userDialog.subscriptionUpdated')}</span>
            <div className="text-sm">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="cursor-help transition-colors hover:text-primary">{dateInfo?.time || t('userDialog.subscriptionNotAccessed')}</span>
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
