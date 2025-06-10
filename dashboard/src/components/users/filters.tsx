import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { debounce } from 'es-toolkit'
import { RefreshCw, SearchIcon, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGetUsers, UserStatus } from '@/service/api'
import { RefetchOptions } from '@tanstack/react-query'
import { LoaderCircle } from 'lucide-react'

interface FiltersProps {
  filters: {
    search?: string
    limit?: number
    offset?: number
    sort: string
    status?: UserStatus | null
    load_sub: boolean
  }
  onFilterChange: (filters: Partial<FiltersProps['filters']>) => void
  refetch?: (options?: RefetchOptions) => Promise<any>
}

export const Filters = ({ filters, onFilterChange, refetch }: FiltersProps) => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const [search, setSearch] = useState(filters.search || '')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const userQuery = useGetUsers(filters)
  const handleRefetch = refetch || userQuery.refetch

  // Debounced search function
  const setSearchField = useCallback(
    debounce((value: string) => {
      onFilterChange({
        search: value,
        offset: 0, // Reset to first page when search is updated
      })
    }, 300),
    [onFilterChange], // Recreate the debounced function when onFilterChange changes
  )

  // Handle input change
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value)
    setSearchField(e.target.value)
  }

  // Clear search field
  const clearSearch = () => {
    setSearch('')
    onFilterChange({
      search: '',
      offset: 0,
    })
  }

  // Handle refresh with loading state
  const handleRefreshClick = async () => {
    setIsRefreshing(true)
    try {
      await handleRefetch()
    } finally {
      // Add a small delay to prevent flickering
      setTimeout(() => {
        setIsRefreshing(false)
      }, 300)
    }
  }

  return (
    <div dir={dir} className="flex items-center gap-4 py-4">
      {/* Search Input */}
      <div className="relative w-full md:w-[calc(100%/3-10px)]">
        <SearchIcon className={cn('absolute', dir === 'rtl' ? 'right-2' : 'left-2 ', 'top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 text-input-placeholder')} />
        <Input placeholder={t('search')} value={search} onChange={handleSearchChange} className="pl-8 pr-10" />
        {search && (
          <button onClick={clearSearch} className={cn('absolute', dir === 'rtl' ? 'left-2' : 'right-2', 'top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600')}>
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {/* Refresh Button */}
      <div className="flex items-center gap-2 h-full">
        <Button size="icon-md" onClick={handleRefreshClick} variant="ghost" className="flex items-center gap-2 border" disabled={isRefreshing}>
          <RefreshCw className={cn('w-4 h-4', isRefreshing && 'animate-spin')} />
        </Button>
      </div>
    </div>
  )
}

interface PaginationControlsProps {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalUsers: number
  isLoading: boolean
  onPageChange: (page: number) => Promise<void>
  onItemsPerPageChange: (value: number) => Promise<void>
}

export const PaginationControls = ({ currentPage, totalPages, itemsPerPage, totalUsers, isLoading, onPageChange, onItemsPerPageChange }: PaginationControlsProps) => {
  const { t } = useTranslation()

  const getPaginationRange = (currentPage: number, totalPages: number) => {
    const delta = 2 // Number of pages to show on each side of current page
    const range = []

    // Handle small number of pages
    if (totalPages <= 5) {
      for (let i = 0; i < totalPages; i++) {
        range.push(i)
      }
      return range
    }

    // Always include first and last page
    range.push(0)

    // Calculate start and end of range
    let start = Math.max(1, currentPage - delta)
    let end = Math.min(totalPages - 2, currentPage + delta)

    // Adjust range if current page is near start or end
    if (currentPage - delta <= 1) {
      end = Math.min(totalPages - 2, start + 2 * delta)
    }
    if (currentPage + delta >= totalPages - 2) {
      start = Math.max(1, totalPages - 3 - 2 * delta)
    }

    // Add ellipsis if needed
    if (start > 1) {
      range.push(-1) // -1 represents ellipsis
    }

    // Add pages in range
    for (let i = start; i <= end; i++) {
      range.push(i)
    }

    // Add ellipsis if needed
    if (end < totalPages - 2) {
      range.push(-1) // -1 represents ellipsis
    }

    // Add last page
    if (totalPages > 1) {
      range.push(totalPages - 1)
    }

    return range
  }

  const paginationRange = getPaginationRange(currentPage, totalPages)
  const dir = useDirDetection()
  return (
    <div className="mt-4 flex flex-col-reverse md:flex-row gap-4 items-center justify-between">
      <div className="flex items-center gap-2">
        <Select value={itemsPerPage.toString()} onValueChange={value => onItemsPerPageChange(parseInt(value, 10))} disabled={isLoading}>
          <SelectTrigger className="w-[70px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="30">30</SelectItem>
              <SelectItem value="40">40</SelectItem>
              <SelectItem value="50">50</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground whitespace-nowrap">{t('itemsPerPage')}</span>
      </div>

      <Pagination dir="ltr" className={`md:justify-end ${dir === 'rtl' ? 'flex-row-reverse' : ''}`}>
        <PaginationContent className="max-w-[300px] overflow-x-auto sm:max-w-full">
          <PaginationItem>
            <PaginationPrevious onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 0 || isLoading} />
          </PaginationItem>
          {paginationRange.map((pageNumber, i) =>
            pageNumber === -1 ? (
              <PaginationItem key={`ellipsis-${i}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={pageNumber}>
                <PaginationLink
                  isActive={currentPage === pageNumber}
                  onClick={() => onPageChange(pageNumber as number)}
                  disabled={isLoading}
                  className={isLoading && currentPage === pageNumber ? 'opacity-70' : ''}
                >
                  {isLoading && currentPage === pageNumber ? (
                    <div className="flex items-center">
                      <LoaderCircle className="h-3 w-3 mr-1 animate-spin" />
                      {(pageNumber as number) + 1}
                    </div>
                  ) : (
                    (pageNumber as number) + 1
                  )}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages - 1 || totalPages === 0 || isLoading} />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
