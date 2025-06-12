import dayjs from 'dayjs'
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

  if (!expiryDate) {
    return dateInfo
  }

  // Convert to ISO string if it's a timestamp
  const isoDate = typeof expiryDate === 'number' ? timestampToISO(expiryDate) : expiryDate
  
  const isAfter = dayjs(isoDate).isAfter(dayjs())
  
  dateInfo.status = isAfter ? t('expires') : t('expired')
  
  const durationSlots: string[] = []
  const duration = dayjs.duration(
    dayjs(isoDate).diff(dayjs())
  )
  
  if (duration.years() != 0) {
    durationSlots.push(
      Math.abs(duration.years()) +
      ' ' +
      t(
        `time.${Math.abs(duration.years()) !== 1 ? 'years' : 'year'}`
      )
    )
  }
  if (duration.months() != 0) {
    durationSlots.push(
      Math.abs(duration.months()) +
      ' ' +
      t(
        `time.${Math.abs(duration.months()) !== 1 ? 'months' : 'month'}`
      )
    )
  }
  if (duration.days() != 0) {
    durationSlots.push(
      Math.abs(duration.days()) +
      ' ' +
      t(
        `time.${Math.abs(duration.days()) !== 1 ? 'days' : 'day'}`
      )
    )
  }
  if (durationSlots.length === 0) {
    if (duration.hours() != 0) {
      durationSlots.push(
        Math.abs(duration.hours()) +
        ' ' +
        t(
          `time.${Math.abs(duration.hours()) !== 1 ? 'hours' : 'hour'}`
        )
      )
    }
    if (duration.minutes() != 0) {
      durationSlots.push(
        Math.abs(duration.minutes()) +
        ' ' +
        t(
          `time.${Math.abs(duration.minutes()) !== 1 ? 'mins' : 'min'}`
        )
      )
    }
  }
  
  // Add "ago" for past dates
  if (!isAfter && durationSlots.length > 0) {
    dateInfo.time = durationSlots.join(', ') + ' ' + t('time.ago')
  } else {
    dateInfo.time = durationSlots.join(', ')
  }

  return dateInfo
}

// Export helper functions for use in other components
export const dateUtils = {
  timestampToISO,
  isoToTimestamp,
  // Helper to get current time in ISO format with timezone
  getCurrentISOTime: () => {
    const now = new Date()
    const tzOffset = -now.getTimezoneOffset()
    const offsetSign = tzOffset >= 0 ? '+' : '-'
    const pad = (num: number) => Math.abs(num).toString().padStart(2, '0')
    
    const offsetHours = pad(Math.floor(tzOffset / 60))
    const offsetMinutes = pad(tzOffset % 60)
    
    return now.toISOString().slice(0, -1) + `${offsetSign}${offsetHours}:${offsetMinutes}`
  },
  // Helper to format date for display
  formatDate: (date: string | number | Date) => {
    const d = typeof date === 'string' ? new Date(date) : 
             typeof date === 'number' ? new Date(date * 1000) : date
    return d.toLocaleString()
  },
  // Helper to check if a date is valid
  isValidDate: (date: string | number | Date) => {
    const d = typeof date === 'string' ? new Date(date) : 
             typeof date === 'number' ? new Date(date * 1000) : date
    return !isNaN(d.getTime())
  }
}
