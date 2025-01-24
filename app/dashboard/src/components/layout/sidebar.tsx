import Logo from '@/assets/logo.svg?react'
import { GithubStar } from '@/components/github-star'
import { Language } from '@/components/Language'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { ThemeToggle } from '@/components/theme-toggle'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from '@/components/ui/sidebar'
import { DONATION_URL, REPO_URL } from '@/constants/Project'
import useDirDetection from '@/hooks/use-dir-detection'
import { BookOpen, GithubIcon, LifeBuoy, ListTodo, PieChart, RssIcon, Settings2, Share2Icon, UsersIcon } from 'lucide-react'
import * as React from 'react'
import { useTranslation } from 'react-i18next'

const data = {
  user: {
    name: 'Admin',
  },
  navMain: [
    {
      title: 'users',
      url: '/',
      icon: UsersIcon,
    },
    {
      title: 'statistics',
      url: '/statistics',
      icon: PieChart,
    },
    {
      title: 'hosts',
      url: '/hosts',
      icon: ListTodo,
    },
    {
      title: 'nodes',
      url: '/nodes',
      icon: Share2Icon,
    },
    {
      title: 'settings',
      url: '/settings',
      icon: Settings2,
      items: [
        {
          title: 'general',
          url: '/settings',
        },
        {
          title: 'core',
          url: '/settings/core',
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: 'Support Us',
      url: DONATION_URL,
      icon: LifeBuoy,
      target: '_blank',
    },
  ],
  community: [
    {
      title: 'Documentation',
      url: '#',
      icon: BookOpen,
    },
    {
      title: 'Discussion Group',
      url: '#',
      icon: RssIcon,
    },
    {
      title: 'GitHub',
      url: '#',
      icon: GithubIcon,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const isRTL = useDirDetection() === 'rtl'
  const { t } = useTranslation()
  return (
    <>
      <div className="sticky top-0 z-30 bg-sidebar flex lg:hidden border-b border-sidebar-border py-3 px-4 justify-between items-center">
        <div className="flex gap-2 items-center">
          <Logo className="!w-4 !h-4 stroke-[2px]" />
          <span className="text-sm font-normal">{t('marzban')}</span>
        </div>
        <SidebarTrigger />
      </div>
      <Sidebar variant="sidebar" {...props} className="border-sidebar-border p-0" side={isRTL ? 'right' : 'left'}>
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href={REPO_URL} target="_blank" className="!gap-0">
                  <Logo className="!w-5 !h-5 stroke-[2px]" />
                  <span className="truncate font-semibold text-sm leading-tight ltr:ml-2 rtl:mr-2">{t('marzban')}</span>
                  <span className="text-xs opacity-45 ltr:ml-1 rtl:mr-1">v0.10</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
          <NavSecondary items={data.community} label="Community" />
          <NavSecondary items={data.navSecondary} className="mt-auto" />
          <div className="flex justify-between px-4 [&>:first-child]:[direction:ltr]">
            <GithubStar />
            <div className="flex gap-2 items-start">
              <Language />
              <ThemeToggle />
            </div>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <NavUser user={data.user} />
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
