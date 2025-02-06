import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pagination, PaginationContent, PaginationEllipsis, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination'
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useDashboard } from '@/contexts/DashboardContext'
import useDirDetection from '@/hooks/use-dir-detection'
import { cn } from '@/lib/utils'
import { debounce } from 'es-toolkit'
import { RefreshCw, SearchIcon, X } from 'lucide-react'
import { useCallback, useState } from 'react'
import { useTranslation } from 'react-i18next'

export const Filters = () => {
  const { t } = useTranslation()
  const dir = useDirDetection()
  const { filters, loading, onFilterChange, refetchUsers } = useDashboard()
  const [search, setSearch] = useState(filters.search || '')

  // Debounced search function
  const setSearchField = useCallback(
    debounce((value: string) => {
      onFilterChange({
        ...filters,
        search: value,
        offset: 0, // Reset to first page when search is updated
      })
    }, 300),
    [filters, onFilterChange], // Recreate the debounced function when filters or onFilterChange change
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
      ...filters,
      search: '',
      offset: 0,
    })
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
        <Button size="icon-md" onClick={refetchUsers} disabled={loading} variant="ghost" className="flex items-center gap-2 border">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>
    </div>
  )
}

const getPaginationRange = (currentPage: number, totalPages: number, siblingCount: number = 1) => {
  const totalPageNumbers = siblingCount * 2 + 3 // Pages to show + first/last + ellipses
  const range = (start: number, end: number) => Array.from({ length: end - start }, (_, idx) => start + idx)

  if (totalPages <= totalPageNumbers) {
    return range(0, totalPages) // Show all pages if they fit
  }

  const leftSiblingIndex = Math.max(currentPage - siblingCount, 1)
  const rightSiblingIndex = Math.min(currentPage + siblingCount, totalPages - 2)

  const showLeftEllipsis = leftSiblingIndex > 1
  const showRightEllipsis = rightSiblingIndex < totalPages - 2

  if (!showLeftEllipsis && showRightEllipsis) {
    return [...range(0, 2 + siblingCount * 2), '...', totalPages - 1]
  }

  if (showLeftEllipsis && !showRightEllipsis) {
    return [0, '...', ...range(totalPages - (3 + siblingCount * 2), totalPages)]
  }

  return [0, '...', ...range(leftSiblingIndex, rightSiblingIndex + 1), '...', totalPages - 1]
}

export const PaginationControls = () => {
  const { filters, onFilterChange, users } = useDashboard()
  const [itemsPerPage, setItemsPerPage] = useState(filters.limit || 20)
  const [currentPage, setCurrentPage] = useState(filters.offset ? filters.offset / itemsPerPage : 0)
  const { t } = useTranslation()

  // Get totalUsers from filters (ensure it's available in your state)
  const totalUsers = users.total || 0 // Ensure fallback value if not available

  const handleItemsPerPageChange = (value: string) => {
    const newLimit = parseInt(value, 10)
    setItemsPerPage(newLimit)
    setCurrentPage(0) // Reset to first page when items per page changes
    onFilterChange({
      ...filters,
      limit: newLimit,
      offset: 0,
    })
  }

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage)
    onFilterChange({
      ...filters,
      offset: newPage * itemsPerPage,
    })
  }

  // Pagination controls
  const totalPages = Math.ceil(totalUsers / itemsPerPage)

  const paginationRange = getPaginationRange(currentPage, totalPages)

  return (
    <div className="flex flex-col md:flex-row-reverse gap-y-3 justify-between items-center my-4">
      {/* Pagination Controls */}
      <div className=" max-w-full overflow-y-auto">
        <Pagination className="justify-end w-[26rem]">
          <PaginationContent>
            {/* Previous Button */}
            <PaginationItem>
              <PaginationPrevious
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 0}
                className={`cursor-pointer ${currentPage === 0 ? 'opacity-50 !pointer-events-auto cursor-not-allowed hover:bg-inherit' : ''}`}
              />
            </PaginationItem>

            {/* Page Links */}
            {paginationRange.map((page, index) => (
              <PaginationItem key={index}>
                {page === '...' ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    className="cursor-pointer"
                    onClick={() => handlePageChange(page as number)}
                    isActive={currentPage === page} // Set isActive property
                  >
                    {+page + 1}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            {/* Next Button */}
            <PaginationItem>
              <PaginationNext
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages - 1}
                className={`cursor-pointer ${currentPage === totalPages - 1 ? 'opacity-50 !pointer-events-auto cursor-not-allowed hover:bg-inherit' : ''}`}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>

      {/* Items per Page */}
      <div className="flex items-center justify-center">
        <div className="flex items-center gap-2">
          <Select value={itemsPerPage.toString()} onValueChange={value => handleItemsPerPageChange(value)}>
            <SelectTrigger className="w-[80px]">
              <SelectValue placeholder="Select items per page" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup className="w-[80px]">
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
          <span className="text-sm whitespace-nowrap">{t('itemsPerPage')}</span>
        </div>
      </div>
    </div>
  )
}
