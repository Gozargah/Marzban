import Logo from '@/assets/logo.svg?react'
import { GithubStar } from '@/components/github-star'
import { Language } from '@/components/Language'
import { ModeToggle } from '@/components/mode-toggle'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarTrigger } from '@/components/ui/sidebar'
import { DONATION_URL, REPO_URL } from '@/constants/Project'
import { BookOpen, GithubIcon, LifeBuoy, ListTodo, PieChart, RssIcon, Settings2, Share2Icon, UsersIcon } from 'lucide-react'
import * as React from 'react'

const data = {
  user: {
    name: 'Admin',
  },
  navMain: [
    {
      title: 'Users',
      url: '/',
      icon: UsersIcon,
    },
    {
      title: 'Statistics',
      url: '/statistics',
      icon: PieChart,
    },
    {
      title: 'Hosts',
      url: '/hosts',
      icon: ListTodo,
    },
    {
      title: 'Nodes',
      url: '/nodes',
      icon: Share2Icon,
    },
    {
      title: 'Settings',
      url: '/settings',
      icon: Settings2,
      items: [
        {
          title: 'General',
          url: '/settings',
        },
        {
          title: 'Core',
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
  return (
    <>
      <div className="flex md:hidden border-b border-sidebar-border py-2 px-4 justify-between items-center">
        <div className="flex gap-2 items-center">
          <Logo className="!w-4 !h-4 stroke-[2px]" />
          <span className="text-sm font-normal">Marzban</span>
        </div>
        <SidebarTrigger />
      </div>
      <Sidebar variant="inset" {...props} className="border-r border-sidebar-border p-0">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href={REPO_URL} target="_blank">
                  <Logo className="!w-5 !h-5 stroke-[2px]" />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">
                      Marzban <span className="truncate text-xs opacity-45">v0.10</span>
                    </span>
                  </div>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
          <NavSecondary items={data.community} label="Community" />
          <NavSecondary items={data.navSecondary} className="mt-auto" />
          <div className="flex justify-between px-4">
            <GithubStar />
            <div className="flex gap-2 items-start">
              <Language />
              <ModeToggle />
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
