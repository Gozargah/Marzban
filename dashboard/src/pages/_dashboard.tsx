import { Footer } from '@/components/Footer'
import { AppSidebar } from '@/components/layout/sidebar'
import PageTransition from '@/components/PageTransition'
import RouteGuard from '@/components/RouteGuard'
import { SidebarProvider } from '@/components/ui/sidebar'
import { getCurrentAdmin } from '@/service/api'
import { Outlet } from 'react-router'

export const clientLoader = async (): Promise<any> => {
  try {
    const response = await getCurrentAdmin()
    return response
  } catch (error) {
    throw Response.redirect('/login')
  }
}

export default function DashboardLayout() {
  return (
    <SidebarProvider>
      <RouteGuard>
        <div className="w-full flex flex-col lg:flex-row">
          <AppSidebar />
          <div className="flex flex-col justify-between min-h-screen gap-y-4 w-full">
            <PageTransition duration={250}>
              <Outlet />
            </PageTransition>
            <Footer />
          </div>
        </div>
      </RouteGuard>
    </SidebarProvider>
  )
}
