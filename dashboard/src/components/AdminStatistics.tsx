import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils.ts'
import { numberWithCommas } from '@/utils/formatByte'
import { useTranslation } from 'react-i18next'
import { Card, CardTitle } from '@/components/ui/card'
import { type AdminDetails } from '@/service/api'
import { User, UserCheck, UserX } from 'lucide-react'
import React from 'react'

interface AdminsStatisticsProps {
  data: AdminDetails[]
}

export default function AdminStatisticsSection({ data }: AdminsStatisticsProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const total = data.length
  const disabled = data.filter(a => a.is_disabled).length
  const active = total - disabled

  const stats = [
    {
      icon: User,
      label: t('admins.total'),
      value: total,
      color: ''
    },
    {
      icon: UserCheck,
      label: t('admins.active'),
      value: active,
      color: ''
    },
    {
      icon: UserX,
      label: t('admins.disable'),
      value: disabled,
      color: ''
    }
  ]

  return (
    <div className={cn('flex flex-col lg:flex-row items-center justify-between gap-x-4 gap-y-4', dir === 'rtl' && 'lg:flex-row-reverse')}>
      {stats.map((stat, idx) => (
        <Card
          key={stat.label}
          dir={dir}
          className={cn(
            "group relative w-full animate-fade-in rounded-md transition-all duration-300 hover:shadow-lg",
          )}
          style={{
            animationDuration: '600ms',
            animationDelay: `${(idx + 1) * 100}ms`,
            animationFillMode: 'both'
          }}
        >
          <div className={cn(
            'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
            'dark:from-primary/5 dark:to-transparent',
            'group-hover:opacity-100'
          )} />
          <CardTitle className="flex items-center justify-between gap-x-4 relative z-10 p-5">
            <div className="flex items-center gap-x-4">
              {React.createElement(stat.icon, { className: "h-6 w-6" })}
              <span>{stat.label}</span>
            </div>
            <span className="text-3xl font-bold" dir="ltr">{numberWithCommas(stat.value)}</span>
          </CardTitle>
        </Card>
      ))}
    </div>
  )
}
