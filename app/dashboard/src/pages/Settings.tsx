import Tabs from '@/components/Tabs'
import { useSidebar } from '@/hooks/use-sidebar'
import { useStore } from '@/hooks/use-store'
import { Outlet } from 'react-router-dom'

const Settings = () => {
  const sidebar = useStore(useSidebar, x => x)
  if (!sidebar) return null
  return (
    <div>
      <div>
        <Tabs />
      </div>
      <div className="mx-auto py-10">
        <Outlet />
      </div>
    </div>
  )
}

export default Settings
