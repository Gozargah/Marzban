import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SystemStats } from '@/service/api'
import { useTranslation } from 'react-i18next'
import { Users, Activity, UserX, UserMinus, Clock, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import { numberWithCommas } from '@/utils/formatByte'

interface UserStatisticsSectionProps {
  data?: SystemStats
}

export default function UserStatisticsSection({ data }: UserStatisticsSectionProps) {
  const { t } = useTranslation()
  const dir = useDirDetection()

  const userStats = [
    {
      icon: <Users className="h-5 w-5 text-primary" />,
      label: t('statistics.onlineUsers'),
      value: data?.online_users || 0,
      totalValue: data?.total_user || 0,
      showTotal: true,
      key: 'online_users',
    },
    {
      icon: <Activity className="h-5 w-5 text-primary" />,
      label: t('statistics.activeUsers'),
      value: data?.active_users || 0,
      key: 'active_users',
    },
    {
      icon: <UserX className="h-5 w-5 text-primary" />,
      label: t('statistics.expiredUsers'),
      value: data?.expired_users || 0,
      key: 'expired_users',
    },
    {
      icon: <UserMinus className="h-5 w-5 text-primary" />,
      label: t('statistics.limitedUsers'),
      value: data?.limited_users || 0,
      key: 'limited_users',
    },
    {
      icon: <Ban className="h-5 w-5 text-primary" />,
      label: t('statistics.disabledUsers'),
      value: data?.disabled_users || 0,
      key: 'disabled_users',
    },
    {
      icon: <Clock className="h-5 w-5 text-primary" />,
      label: t('statistics.onHoldUsers'),
      value: data?.on_hold_users || 0,
      key: 'on_hold_users',
    },
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('statistics.users')}</CardTitle>
        <CardDescription>{t('monitorUsers')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {userStats.map((stat, index) => (
          <div
            key={stat.key}
            className="w-full animate-fade-in"
            style={{
              animationDuration: '600ms',
              animationDelay: `${(index + 1) * 100}ms`,
              animationFillMode: 'both',
            }}
          >
            <Card dir={dir} className="group relative w-full overflow-hidden rounded-lg border transition-all duration-300 hover:shadow-lg">
              <div
                className={cn(
                  'absolute inset-0 bg-gradient-to-r from-primary/10 to-transparent opacity-0 transition-opacity duration-500',
                  'dark:from-primary/5 dark:to-transparent',
                  'group-hover:opacity-100',
                )}
              />
              <CardContent className="relative z-10 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-primary/10 p-2">{stat.icon}</div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
                      <div className="flex items-center gap-2">
                        <span dir="ltr" className="text-2xl font-bold">
                          {stat.showTotal ? (
                            <>
                              {numberWithCommas(stat.value)} / {numberWithCommas(stat.totalValue || 0)}
                            </>
                          ) : (
                            numberWithCommas(stat.value)
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
