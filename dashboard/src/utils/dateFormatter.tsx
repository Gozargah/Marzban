import dayjs from '@/lib/dayjs'
import { useTranslation } from 'react-i18next'

// Helper function to convert timestamp to ISO string
function timestampToISO(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString()
}

// Helper function to convert ISO string to timestamp
function isoToTimestamp(isoString: string): number {
  return Math.floor(new Date(isoString).getTime() / 1000)
}

export const useRelativeExpiryDate = (
  expiryDate: string | number | null | undefined,
) => {
  const { t } = useTranslation()
  const dateInfo = { status: '', time: '' }

  if (!expiryDate) return dateInfo

  const target = dateUtils.toDayjs(expiryDate)
  const now = dayjs()

  const isAfter = target.isAfter(now) // This is now a dayjs object
  dateInfo.status = isAfter ? t('expires') : t('expired')

  const duration = dayjs.duration(target.diff(now))
  const durationSlots: string[] = []

  if (duration.years()) {
    durationSlots.push(
      `${Math.abs(duration.years())} ${t(`time.${Math.abs(duration.years()) !== 1 ? 'years' : 'year'}`)}`
    )
  }

  if (duration.months()) {
    durationSlots.push(
      `${Math.abs(duration.months())} ${t(`time.${Math.abs(duration.months()) !== 1 ? 'months' : 'month'}`)}`
    )
  }

  if (duration.days()) {
    durationSlots.push(
      `${Math.abs(duration.days())} ${t(`time.${Math.abs(duration.days()) !== 1 ? 'days' : 'day'}`)}`
    )
  }

  if (durationSlots.length === 0) {
    if (duration.hours()) {
      durationSlots.push(
        `${Math.abs(duration.hours())} ${t(`time.${Math.abs(duration.hours()) !== 1 ? 'hours' : 'hour'}`)}`
      )
    }

    if (duration.minutes()) {
      durationSlots.push(
        `${Math.abs(duration.minutes())} ${t(`time.${Math.abs(duration.minutes()) !== 1 ? 'mins' : 'min'}`)}`
      )
    }
  }

  dateInfo.time = durationSlots.join(', ') + (isAfter ? '' : ` ${t('time.ago')}`)
  return dateInfo
}

// Export helper functions for use in other components
export const dateUtils = {
  timestampToISO,
  isoToTimestamp,

  getCurrentISOTime: () => {
    return dayjs().toISOString() // ISO in UTC (standard)
  },

  formatDate: (date: string | number | Date) => {
    const d = typeof date === 'string'
      ? dayjs.utc(date).local()
      : typeof date === 'number'
        ? dayjs.unix(date).local()
        : dayjs(date).local()

    return d.format('YYYY-MM-DD HH:mm:ss')
  },

  toDayjs: (date: string | number | Date) => {
    return typeof date === 'string'
      ? dayjs.utc(date).local()
      : typeof date === 'number'
        ? dayjs.unix(date).local()
        : dayjs(date).local()
  },

  isValidDate: (date: string | number | Date) => {
    const d = typeof date === 'string'
      ? new Date(date)
      : typeof date === 'number'
        ? new Date(date * 1000)
        : date

    return !isNaN(d.getTime())
  },

  daysToSeconds: (days: number | undefined): number | undefined => {
    if (days === undefined || days === null || days === 0) return undefined
    return Math.round(Number(days) * 24 * 60 * 60)
  },

  secondsToDays: (seconds: number | undefined): number | undefined => {
    if (seconds === undefined || seconds === null || seconds === 0) return undefined
    return Math.round(Number(seconds) / (24 * 60 * 60))
  }
}

