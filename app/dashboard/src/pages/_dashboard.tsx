import { Footer } from '@/components/Footer'
import { AppSidebar } from '@/components/layout/sidebar'
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
      <div className="w-full flex flex-col md:flex-row gap-1">
        <AppSidebar />
        <div className="flex flex-col justify-between min-h-screen gap-y-4 w-full px-4 py-4">
          <Outlet />
          <Footer />
        </div>
      </div>
    </SidebarProvider>
  )
}
