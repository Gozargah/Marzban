import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { dateUtils } from '@/utils/dateFormatter'
import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import dayjs from '@/lib/dayjs'

type UserStatusProps = {
  lastOnline: string | number | null | undefined
}

export const OnlineStatus: FC<UserStatusProps> = ({ lastOnline }) => {
  const { t } = useTranslation()
  const dir = useDirDetection()

  if (!lastOnline) {
    return (
      <span className={cn('inline-block text-xs font-medium', dir === 'rtl' ? 'mr-0.5 md:mr-2' : 'ml-0.5 md:ml-2', 'text-gray-600 dark:text-gray-400')}>
        {t('notConnectedYet')}
      </span>
    )
  }

  const currentTime = dayjs()
  const lastOnlineTime = dateUtils.toDayjs(lastOnline)
  const diffInSeconds = currentTime.diff(lastOnlineTime, 'seconds')

  const isOnline = diffInSeconds <= 60

  if (isOnline) {
    return (
      <span className={cn('inline-block text-xs font-medium', dir === 'rtl' ? 'mr-0.5 md:mr-2' : 'ml-0.5 md:ml-2', 'text-gray-600 dark:text-gray-400')}>
        {t('online')}
      </span>
    )
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

    return (
      <span className={cn('inline-block text-xs font-medium', dir === 'rtl' ? 'mr-0.5 md:mr-2' : 'ml-0.5 md:ml-2', 'text-gray-600 dark:text-gray-400')}>
        {timeText}
      </span>
    )
  }
}
