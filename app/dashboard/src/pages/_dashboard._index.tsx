import { PaginationControls } from '@/components/users-table/filters'
import UsersTable from '@/components/users-table/users-table'

const Dashboard = () => {
  return (
    <div className="pb-8">
      <UsersTable />
      <PaginationControls />
    </div>
  )
}

export default Dashboard
