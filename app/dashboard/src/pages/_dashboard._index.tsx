import PageHeader from '@/components/page-header'
import { Separator } from '@/components/ui/separator'
import { PaginationControls } from '@/components/users-table/filters'
import UsersTable from '@/components/users-table/users-table'
import UsersStatistics from '@/components/UsersStatistics'
import { Plus } from 'lucide-react'

const Dashboard = () => {
  return (
    <div className="flex flex-col gap-2 w-full items-start">
      <PageHeader title="users" description="manageAccounts" buttonIcon={Plus} buttonText="createUser" onButtonClick={() => ''} />
      <Separator />
      <div className="px-4 w-full pt-2">
        <UsersStatistics />
        <UsersTable />
        <PaginationControls />
      </div>
    </div>
  )
}

export default Dashboard
