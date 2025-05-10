import {Input} from '@/components/ui/input'
import {SearchIcon, X} from 'lucide-react'
import {cn} from '@/lib/utils'
import useDirDetection from '@/hooks/use-dir-detection'
import {useTranslation} from 'react-i18next'
import {useState, useCallback} from 'react'
import {debounce} from 'es-toolkit'
import {GroupsResponse} from '@/service/api'

export default function GroupFilterBar({onFilteredGroups, data}: {
    onFilteredGroups: (groups: any[]) => void,
    data: GroupsResponse | undefined
}) {
    const {t} = useTranslation()
    const dir = useDirDetection()
    const [search, setSearch] = useState('')
    const groups = data?.groups || []

    // Debounced filter function
    const filterGroups = useCallback(
        debounce((value: string) => {
            const filtered = groups.filter(g =>
                g.name.toLowerCase().includes(value.toLowerCase())
            )
            onFilteredGroups(filtered)
        }, 300),
        [groups, onFilteredGroups]
    )

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSearch(e.target.value)
        filterGroups(e.target.value)
    }

    const clearSearch = () => {
        setSearch('')
        onFilteredGroups(groups)
    }

    return (
        <div dir={dir} className="flex items-center gap-4 pb-4">
            <div className="relative w-full">
                <SearchIcon
                    className={cn('absolute', dir === 'rtl' ? 'right-2' : 'left-2 ', 'top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 text-input-placeholder')}/>
                <Input
                    placeholder={t('search')}
                    value={search}
                    onChange={handleSearchChange}
                    className="pl-8 pr-10 bg-[--background-custom]"
                />
                {search && (
                    <button
                        onClick={clearSearch}
                        className={cn('absolute', dir === 'rtl' ? 'left-2' : 'right-2', 'top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600')}
                    >
                        <X className="w-4 h-4"/>
                    </button>
                )}
            </div>
        </div>
    )
}