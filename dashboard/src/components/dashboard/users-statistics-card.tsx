import { ActivityIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { SystemStats, useGetSystemStats } from '@/service/api'

const UserStatisticsCard = ({ data }: { data: SystemStats | undefined }) => {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('Users')}</CardTitle>
        <CardDescription>{t('monitorUsers')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <UsersIcon className="text-muted-foreground" />
          {t('totalUsers')}
          <span className="ms-auto font-bold">{data?.total_user || 0}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <ActivityIcon className="text-muted-foreground" />
          {t('activeUsers')}
          <span className="ms-auto font-bold">{data?.active_users || 0}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-green-600" />
          {t('onlineUsers')}
          <span className="ms-auto font-bold">{data?.online_users || 0}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-red-600" />
          {t('expiredUsers')}
          <span className="ms-auto font-bold">{data?.expired_users || 0}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-orange-600" />
          {t('limitedUsers')}
          <span className="ms-auto font-bold">{data?.limited_users || 0}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-purple-600" />
          {t('onHoldUsers')}
          <span className="ms-auto font-bold">{data?.on_hold_users || 0}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-slate-600" />
          {t('disabledUsers')}
          <span className="ms-auto font-bold">{data?.disabled_users || 0}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default UserStatisticsCard
