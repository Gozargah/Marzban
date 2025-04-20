import {useTranslation} from 'react-i18next'
import type {AdminDetails} from '@/service/api'
import {DataTable} from './data-table'
import {setupColumns} from './columns'
import {Filters} from './filters'
import {useState} from 'react'
import {PaginationControls} from "./filters.tsx";

interface AdminFilters {
  sort: string
  search?: string
  limit: number
  offset: number
}

interface AdminsTableProps {
  data: AdminDetails[]
  onEdit: (admin: AdminDetails) => void
  onDelete: (admin: AdminDetails) => void
}

export default function AdminsTable({data, onEdit, onDelete}: AdminsTableProps) {
  const {t} = useTranslation()
  const [filters, setFilters] = useState<AdminFilters>({
    sort: '-username',
    search: '',
    limit: 10,
    offset: 0,
  })


  const handleSort = (column: string) => {
    let newSort: string

    if (filters.sort === column) {
      newSort = '-' + column
    } else if (filters.sort === '-' + column) {
      newSort = '-username'
    } else {
      newSort = column
    }

    setFilters(prev => ({...prev, sort: newSort}))
  }

  const handleFilterChange = (newFilters: Partial<AdminFilters>) => {
    setFilters(prev => ({...prev, ...newFilters}))
  }

  const columns = setupColumns({
    t,
    handleSort,
    filters,
    onDelete,
  })

  return (
      <div>
        <Filters filters={filters} onFilterChange={handleFilterChange}/>
        <DataTable columns={columns} data={data} onEdit={onEdit} onDelete={onDelete}/>
        <PaginationControls/>
      </div>
  )
} 