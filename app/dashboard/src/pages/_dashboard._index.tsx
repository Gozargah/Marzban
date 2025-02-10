import PageHeader from '@/components/page-header'
import { PaginationControls } from '@/components/users-table/filters'
import UsersTable from '@/components/users-table/users-table'
import UsersStatistics from '@/components/UsersStatistics'
import { Plus } from 'lucide-react'

const Dashboard = () => {

  return (
    <div>
      <div className='mb-6'>
        <PageHeader
          title='users'
          description='manageAccounts'
          buttonIcon={Plus}
          buttonText='createUser'
          onButtonClick={() => ""}
        />
      </div>
      <div>
        <UsersStatistics />
        <UsersTable />
        <PaginationControls />
      </div>
    </div>
  )
}

export default Dashboard
