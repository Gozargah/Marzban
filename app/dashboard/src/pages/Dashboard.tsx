import { PaginationControls } from '@/components/users-table/filters'
import UsersTable from '@/components/users-table/users-table'
import { useSidebar } from '@/hooks/use-sidebar'
import { useStore } from '@/hooks/use-store'

const Dashboard = () => {
  const sidebar = useStore(useSidebar, x => x)
  if (!sidebar) return null
  return (
    <div className="pb-8">
      <div className="mx-auto pt-6 pb-10">
        <UsersTable />
        <PaginationControls />
      </div>
    </div>
  )
}

export default Dashboard
