'use client'

import * as React from 'react'
import { addDays, format } from 'date-fns'
import { Calendar as CalendarIcon } from 'lucide-react'
import { DateRange } from 'react-day-picker'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useTranslation } from 'react-i18next'
import { Calendar as PersianCalendar } from '@/components/ui/persian-calendar'

interface TimeRangeSelectorProps extends React.HTMLAttributes<HTMLDivElement> {
  onRangeChange: (range: DateRange | undefined) => void
  initialRange?: DateRange
}

export function TimeRangeSelector({ className, onRangeChange, initialRange }: TimeRangeSelectorProps) {
  const { t, i18n } = useTranslation()
  const isPersianLocale = i18n.language === 'fa'
  const [date, setDate] = React.useState<DateRange | undefined>(
    initialRange ?? {
      from: addDays(new Date(), -7), // Default to last 7 days
      to: new Date(),
    },
  )

  React.useEffect(() => {
    // Propagate initial range up if provided
    if (initialRange) {
      onRangeChange(initialRange)
    } else {
      // Propagate default range up on mount
      onRangeChange(date)
    }
  }, []) // Run only on mount

  const handleSelect = (selectedRange: DateRange | undefined) => {
    setDate(selectedRange)
    onRangeChange(selectedRange) // Call the callback prop
  }

  const formatDate = (date: Date) => {
    if (isPersianLocale) {
      return new Intl.DateTimeFormat('fa-IR', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      }).format(date)
    }
    return format(date, 'LLL dd, y')
  }

  return (
    <div className={cn('grid gap-2', className)}>
      <Popover>
        <PopoverTrigger asChild>
          <Button id="date" variant={'outline'} className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
            <CalendarIcon className="mr-2 h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <>
                  {formatDate(date.from)} - {formatDate(date.to)}
                </>
              ) : (
                formatDate(date.from)
              )
            ) : (
              <span>{t('timeSelector.pickDate')}</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          {isPersianLocale ? (
            <PersianCalendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          ) : (
            <Calendar
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={handleSelect}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
