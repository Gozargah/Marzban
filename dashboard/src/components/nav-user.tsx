'use client'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar'
import { type AdminDetails } from '@/service/api'
import { ChevronsUpDown, LogOut, Network, Wifi, Shield, UsersIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatBytes } from '@/utils/formatByte'
import { Badge } from '@/components/ui/badge'

export function NavUser({
  username,
  admin,
}: {
  username: {
    name: string
  }
  admin: AdminDetails | null
}) {
  const { t } = useTranslation()
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="pl-3 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground">
              <div className="grid flex-1 text-left text-sm leading-tight">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold">{username.name}</span>
                  {admin && (
                    <Badge variant={admin.is_sudo ? 'secondary' : 'outline'} className="hidden lg:hidden text-[10px] px-1 py-0 h-4">
                      {admin.is_sudo ? (
                        <>
                          <Shield className="size-3 mr-1" />
                          {t('sudo')}
                        </>
                      ) : (
                        <>
                          <UsersIcon className="size-3 mr-1" />
                          {t('admin')}
                        </>
                      )}
                    </Badge>
                  )}
                </div>
                {admin && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Network className="size-3" />
                    <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{formatBytes(admin?.used_traffic || 0)}</span>
                  </div>
                )}
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg" side={'bottom'} align="end" sideOffset={4}>
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex flex-col gap-2 px-1 py-1.5 text-left text-sm">
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold">{username.name}</span>
                    {admin && (
                      <Badge variant={admin.is_sudo ? 'secondary' : 'outline'} className="text-[10px] py-0 h-4 flex items-center gap-2">
                        {admin.is_sudo ? (
                          <>
                            <Shield className="size-3" />
                            <span>{t('sudo')}</span>
                          </>
                        ) : (
                          <>
                            <UsersIcon className="size-3" />
                            <span>{t('admin')}</span>
                          </>
                        )}
                      </Badge>
                    )}
                  </div>
                </div>
                {admin && (
                  <div className="flex flex-col gap-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Network className="size-3" />
                      <span>
                        {t('admins.used.traffic')}: <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{formatBytes(admin?.used_traffic || 0)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Wifi className="size-3" />
                      <span>
                        {t('admins.lifetime.used.traffic')}: <span dir="ltr" style={{ unicodeBidi: 'isolate' }}>{formatBytes(admin?.lifetime_used_traffic || 0)}</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <UsersIcon className="size-3" />
                      <span>
                        {t('admins.total.users')}: {admin?.total_users || 0}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild className="text-destructive focus:text-destructive">
              <Link to="/login">
                <LogOut className="mr-2 size-4" />
                {t('header.logout')}
              </Link>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
