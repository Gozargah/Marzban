import { ActivityIcon, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card'
import { useGetUsers } from '@/service/api'

const UserStatisticsCard = ({ admin_username }: { admin_username: string }) => {
  const { t } = useTranslation()

  const { data } = useGetUsers({
    admin: [admin_username],
  })

  const now = useMemo(() => new Date(), [])
  const fiveMinutesAgo = useMemo(() => new Date(now.getTime() - 5 * 60 * 1000), [now])

  const totalUsers = data?.total || 0
  const activeUsers = data?.users?.filter(user => user.status === 'active').length || 0

  const onlineUsers =
    data?.users?.filter(user => {
      if (user.status !== 'active' || !user.online_at) return false
      const userOnlineAt = new Date(user.online_at)
      return userOnlineAt >= fiveMinutesAgo && userOnlineAt <= now
    }).length || 0

  const expiredUsers = data?.users?.filter(user => user.status === 'expired').length || 0
  const limitedUsers = data?.users?.filter(user => user.status === 'limited').length || 0
  const onHoldUsers = data?.users?.filter(user => user.status === 'on_hold').length || 0
  const disabledUsers = data?.users?.filter(user => user.status === 'disabled').length || 0

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
          <span className="ms-auto font-bold">{totalUsers}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <ActivityIcon className="text-muted-foreground" />
          {t('activeUsers')}
          <span className="ms-auto font-bold">{activeUsers}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-green-600" />
          {t('onlineUsers')}
          <span className="ms-auto font-bold">{onlineUsers}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-red-600" />
          {t('expiredUsers')}
          <span className="ms-auto font-bold">{expiredUsers}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-orange-600" />
          {t('limitedUsers')}
          <span className="ms-auto font-bold">{limitedUsers}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-purple-600" />
          {t('onHoldUsers')}
          <span className="ms-auto font-bold">{onHoldUsers}</span>
        </div>
        <div className="flex flex-row items-center gap-3 rounded-lg border p-4 shadow">
          <div className="size-4 rounded-full bg-slate-600" />
          {t('disabledUsers')}
          <span className="ms-auto font-bold">{disabledUsers}</span>
        </div>
      </CardContent>
    </Card>
  )
}

export default UserStatisticsCard
