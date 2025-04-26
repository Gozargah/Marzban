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
import {useGetAdmins} from "@/service/api";

interface BaseFilters {
    sort: string
    search?: string
    limit?: number
    offset?: number
}

interface FiltersProps<T extends BaseFilters> {
    filters: T
    onFilterChange: (filters: Partial<T>) => void
    onRefresh?: () => void
    totalItems?: number
}

export function Filters<T extends BaseFilters>({ filters, onFilterChange }: FiltersProps<T>) {
    const { t } = useTranslation()
    const dir = useDirDetection()
    const {refetch} = useGetAdmins(filters)
    const [search, setSearch] = useState(filters.search || '')

    // Debounced search function
    const setSearchField = useCallback(
        debounce((value: string) => {
            onFilterChange({
                search: value,
                offset: 0, // Reset to first page when search is updated
            } as Partial<T>)
        }, 300),
        [onFilterChange],
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
        } as Partial<T>)
    }


    return (
        <div dir={dir} className="flex items-center gap-4 pb-4">
            {/* Search Input */}
            <div className="relative w-full md:w-[calc(100%/3-10px)]">
                <SearchIcon className={cn('absolute', dir === 'rtl' ? 'right-2' : 'left-2 ', 'top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 text-input-placeholder')} />
                <Input placeholder={t('search')} value={search} onChange={handleSearchChange} className="pl-8 pr-10 bg-[--background-custom]" />
                {search && (
                    <button onClick={clearSearch} className={cn('absolute', dir === 'rtl' ? 'left-2' : 'right-2', 'top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600')}>
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
            {/* Refresh Button */}
            <div className="flex items-center gap-2 h-full">
                <Button size="icon-md" onClick={() => refetch()} variant="ghost" className="flex items-center gap-2 border">
                    <RefreshCw className="w-4 h-4" />
                </Button>
            </div>
        </div>
    )
}

export const PaginationControls = () => {
    const { t } = useTranslation()
    const [itemsPerPage, setItemsPerPage] = useState(20)
    const [currentPage, setCurrentPage] = useState(0)
    const { data: adminsData } = useGetAdmins({
        limit: itemsPerPage,
        offset: currentPage * itemsPerPage,

    })

    const totalAdmins = adminsData?.length || 0

    const handleItemsPerPageChange = (value: string) => {
        const newLimit = parseInt(value, 10)
        setItemsPerPage(newLimit)
        setCurrentPage(0) // Reset to first page when items per page changes
    }

    const handlePageChange = (newPage: number) => {
        setCurrentPage(newPage)
    }

    // Pagination controls
    const totalPages = Math.ceil(totalAdmins / itemsPerPage)
    const paginationRange = getPaginationRange(currentPage, totalPages)

    return (
        <div className="mt-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
                <Select value={itemsPerPage.toString()} onValueChange={handleItemsPerPageChange}>
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
                <span className="text-sm text-gray-600">{t('itemsPerPage')}</span>
            </div>

            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 0} />
                    </PaginationItem>
                    {paginationRange.map((pageNumber, i) =>
                        pageNumber === '...' ? (
                            <PaginationItem key={`ellipsis-${i}`}>
                                <PaginationEllipsis />
                            </PaginationItem>
                        ) : (
                            <PaginationItem key={pageNumber}>
                                <PaginationLink isActive={currentPage === pageNumber} onClick={() => handlePageChange(pageNumber as number)}>
                                    {(pageNumber as number) + 1}
                                </PaginationLink>
                            </PaginationItem>
                        ),
                    )}
                    <PaginationItem>
                        <PaginationNext onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages - 1} />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
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


