import { Footer } from '@/components/Footer'
import { AppSidebar } from '@/components/layout/sidebar'
import { SidebarProvider } from '@/components/ui/sidebar'
// import useDirDetection from '@/hooks/use-dir-detection'
import { useSidebar } from '@/hooks/use-sidebar'
import { useStore } from '@/hooks/use-store'
// import { cn } from '@/lib/utils'

export default function AdminPanelLayout({ children }: { children: React.ReactNode }) {
  //   const isRTL = useDirDetection() === 'rtl'

  const sidebar = useStore(useSidebar, x => x)
  if (!sidebar) return null
  //   const { getOpenState, settings } = sidebar

  return (
    <div className="w-full flex gap-1">
      <SidebarProvider>
        <AppSidebar />
        <div className="flex flex-col justify-between min-h-screen gap-y-4 w-full px-6">
          {children}
          <Footer />
        </div>
      </SidebarProvider>
    </div>
  )
}
