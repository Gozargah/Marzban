import Tabs from '@/components/Tabs'
import { Outlet } from 'react-router'

const Settings = () => {
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
