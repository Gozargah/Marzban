import { FC } from 'react'
import { dateUtils } from '../utils/dateFormatter'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from './ui/tooltip'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'

type UserStatusProps = {
  lastOnline?: string | null
}

export const OnlineBadge: FC<UserStatusProps> = ({ lastOnline }) => {
  const { t } = useTranslation()

  const getTooltipText = () => {
    if (!lastOnline) {
      return t('notConnectedYet')
    }

    const currentTime = dayjs()
    const lastOnlineTime = dateUtils.toDayjs(lastOnline)
    const diffInSeconds = currentTime.diff(lastOnlineTime, 'seconds')

    const isOnline = diffInSeconds <= 60

    if (isOnline) {
      return t('online')
    } else {
      // Format the time difference for offline status
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
  }

  const renderBadge = () => {
    if (!lastOnline) {
      return <div className="min-h-[10px] min-w-[10px] rounded-full border border-gray-400 dark:border-gray-600 shadow-sm" />
    }

    const currentTime = dayjs()
    const lastOnlineTime = dateUtils.toDayjs(lastOnline)
    const diffInSeconds = currentTime.diff(lastOnlineTime, 'seconds')

    const isOnline = diffInSeconds <= 60

    if (isOnline) {
      // Online - green dot
      return <div className="min-h-[10px] min-w-[10px] rounded-full bg-green-500 shadow-sm" />
    } else {
      // Offline - gray dot
      return <div className="min-h-[10px] min-w-[10px] rounded-full bg-gray-400 dark:bg-gray-600 shadow-sm" />
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {renderBadge()}
        </TooltipTrigger>
        <TooltipContent>
          <p>{getTooltipText()}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
