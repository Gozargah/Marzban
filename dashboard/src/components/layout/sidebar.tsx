import Logo from '@/assets/logo.svg?react'
import { GithubStar } from '@/components/github-star'
import { Language } from '@/components/Language'
import { NavMain } from '@/components/nav-main'
import { NavSecondary } from '@/components/nav-secondary'
import { NavUser } from '@/components/nav-user'
import { ThemeToggle } from '@/components/theme-toggle'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, SidebarTrigger, useSidebar } from '@/components/ui/sidebar'
import { DISCUSSION_GROUP, DOCUMENTATION, DONATION_URL, REPO_URL } from '@/constants/Project'
import { useAdmin } from '@/hooks/use-admin'
import useDirDetection from '@/hooks/use-dir-detection'
import { getSystemStats } from '@/service/api'
import {
	ArrowUpDown,
	Bell,
	BookOpen,
	Calendar,
	Cpu,
	Database,
	FileText,
	GithubIcon,
	Layers,
	LayoutDashboardIcon,
	LayoutTemplate,
	LifeBuoy,
	ListTodo,
	Lock,
	MessageCircle,
	Palette,
	PieChart,
	RssIcon,
	Send,
	Settings2,
	Share2Icon,
	UserCog,
	Users2,
	Settings,
	UsersIcon,
	Webhook,
} from 'lucide-react'
import * as React from 'react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const isRTL = useDirDetection() === 'rtl'
  const { t } = useTranslation()
  const [version, setVersion] = useState<string>('')
  const { admin } = useAdmin()
  const { setOpenMobile, openMobile } = useSidebar()
  const touchStartX = useRef<number | null>(null)
  const touchEndX = useRef<number | null>(null)
  const minSwipeDistance = 50
  const edgeThreshold = 50 // Distance from edge to detect edge swipe

  const handleTouchStart = (e: TouchEvent) => {
    touchEndX.current = null
    touchStartX.current = e.touches[0].clientX
  }

  const handleTouchMove = (e: TouchEvent) => {
    touchEndX.current = e.touches[0].clientX
  }

  const handleTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return

    const distance = touchStartX.current - touchEndX.current
    const isLeftSwipe = distance > minSwipeDistance
    const isRightSwipe = distance < -minSwipeDistance
    const isFromRightEdge = touchStartX.current > window.innerWidth - edgeThreshold

    // Only handle swipes that start from the right edge
    if (isFromRightEdge) {
      if (isLeftSwipe && !openMobile) {
        setOpenMobile(true)
      } else if (isRightSwipe && openMobile) {
        setOpenMobile(false)
      }
    }

    // Reset touch positions
    touchStartX.current = null
    touchEndX.current = null
  }, [openMobile, setOpenMobile])

  useEffect(() => {
    // Add touch event listeners to the document
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)

    // Cleanup
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchEnd])

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const data = await getSystemStats()
        if (data?.version) {
          setVersion(` (v${data.version})`)
        }
      } catch (error) {
        console.error('Failed to fetch version:', error)
      }
    }
    fetchVersion()
  }, [])

  const data = {
    user: {
      name: admin?.username || 'Admin',
    },
    navMain: [
      {
        title: 'dashboard',
        url: '/',
        icon: LayoutDashboardIcon,
      },
      {
        title: 'users',
        url: '/users',
        icon: UsersIcon,
      },
      ...(admin?.is_sudo
        ? [
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
              title: 'groups',
              url: '/groups',
              icon: Users2,
            },
            {
              title: 'admins.title',
              url: '/admins',
              icon: UserCog,
            },
            {
              title: 'nodes.title',
              url: '/nodes',
              icon: Share2Icon,
              items: [
                {
                  title: 'nodes.title',
                  url: '/nodes',
                  icon: Share2Icon,
                },
                {
                  title: 'settings.cores.title',
                  url: '/nodes/cores',
                  icon: Cpu,
                },
                {
                  title: 'nodes.logs.title',
                  url: '/nodes/logs',
                  icon: FileText,
                },
              ],
            },
            {
              title: 'templates.title',
              url: '/templates',
              icon: LayoutTemplate,
            },
            {
              title: 'bulk.title',
              url: '/bulk',
              icon: Layers,
              items: [
                {
                  title: 'bulk.groups',
                  url: '/bulk',
                  icon: Users2,
                },
                {
                  title: 'bulk.expireDate',
                  url: '/bulk/expire',
                  icon: Calendar,
                },
                {
                  title: 'bulk.dataLimit',
                  url: '/bulk/data',
                  icon: ArrowUpDown,
                },
                {
                  title: 'bulk.proxySettings',
                  url: '/bulk/proxy',
                  icon: Lock,
                },
              ],
            },
            {
              title: 'settings.title',
              url: '/settings',
              icon: Settings2,
              items: [
                {
                  title: 'settings.general.title',
                  url: '/settings/general',
                  icon: Settings,
                },
                {
                  title: 'settings.notifications.title',
                  url: '/settings/notifications',
                  icon: Bell,
                },
                {
                  title: 'settings.subscriptions.title',
                  url: '/settings/subscriptions',
                  icon: ListTodo,
                },
                {
                  title: 'settings.telegram.title',
                  url: '/settings/telegram',
                  icon: Send,
                },
                {
                  title: 'settings.discord.title',
                  url: '/settings/discord',
                  icon: MessageCircle,
                },
                {
                  title: 'settings.webhook.title',
                  url: '/settings/webhook',
                  icon: Webhook,
                },
                {
                  title: 'settings.cleanup.title',
                  url: '/settings/cleanup',
                  icon: Database,
                },
                {
                  title: 'theme.title',
                  url: '/settings/theme',
                  icon: Palette,
                },
              ],
            },
          ]
        : [
            // For non-sudo admins, show only theme settings
            {
              title: 'settings.title',
              url: '/settings',
              icon: Settings2,
              items: [
                {
                  title: 'theme.title',
                  url: '/settings/theme',
                  icon: Palette,
                },
              ],
            },
          ]),
    ],
    navSecondary: [
      {
        title: t('supportUs'),
        url: DONATION_URL,
        icon: LifeBuoy,
        target: '_blank',
      },
    ],
    community: [
      {
        title: 'documentation',
        url: DOCUMENTATION,
        icon: BookOpen,
        target: '_blank',
      },
      {
        title: 'discussionGroup',
        url: DISCUSSION_GROUP,
        icon: RssIcon,
        target: '_blank',
      },
      {
        title: 'github',
        url: REPO_URL,
        icon: GithubIcon,
        target: '_blank',
      },
    ],
  }

  return (
    <>
      <div className="sticky top-0 z-30 flex items-center justify-between border-b border-sidebar-border bg-neutral-200/75 px-4 py-3 backdrop-blur dark:bg-neutral-900/75 lg:hidden">
        <div className="flex items-center gap-2">
          <Logo className="!h-4 !w-4 stroke-[2px]" />
          <span className="text-sm font-bold">{t('marzban')}</span>
        </div>
        <SidebarTrigger />
      </div>
      <Sidebar variant="sidebar" {...props} className="border-sidebar-border p-0" side={isRTL ? 'right' : 'left'}>
        <SidebarRail />
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild>
                <a href={REPO_URL} target="_blank" className="!gap-0">
                  <Logo className="!h-5 !w-5 stroke-[2px]" />
                  <span className="truncate text-sm font-semibold leading-tight ltr:ml-2 rtl:mr-2">{t('marzban')}</span>
                  <span className="text-xs opacity-45 ltr:ml-1 rtl:mr-1">{version}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>
        <SidebarContent>
          <NavMain items={data.navMain} />
          {admin?.is_sudo && <NavSecondary items={data.community} label={t('community')} />}
          <NavSecondary items={data.navSecondary} className="mt-auto" />
          <div className="flex justify-between px-4 [&>:first-child]:[direction:ltr]">
            <GithubStar />
            <div className="flex items-start gap-2">
              <Language />
              <ThemeToggle />
            </div>
          </div>
        </SidebarContent>
        <SidebarFooter>
          <NavUser admin={admin} username={data?.user} />
        </SidebarFooter>
      </Sidebar>
    </>
  )
}
