import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { TFunction } from "i18next"
import { Search } from "lucide-react"
import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

// Types for selector items
interface GroupResponse {
  id: number
  name: string
}
interface UserResponse {
  id: number
  username: string
}
interface AdminDetails {
  id: number
  username: string
}

type SelectorItem = GroupResponse | UserResponse | AdminDetails

type SelectorPanelProps = {
  icon: LucideIcon
  title: string
  items: SelectorItem[]
  selected: number[]
  setSelected: (ids: number[]) => void
  search: string
  setSearch: (s: string) => void
  searchPlaceholder: string
  selectAllLabel: string
  deselectAllLabel: string
  itemLabelKey: "name" | "username"
  itemValueKey: "id"
  searchKey: "name" | "username"
  t: TFunction
}

export function SelectorPanel({
  icon: Icon,
  title,
  items,
  selected,
  setSelected,
  search,
  setSearch,
  searchPlaceholder,
  selectAllLabel,
  deselectAllLabel,
  itemLabelKey,
  itemValueKey,
  searchKey,
  t,
}: SelectorPanelProps) {
  const handleSelectAll = () =>
    setSelected(
      items
        .map((item) => (typeof item[itemValueKey] === "number" ? (item[itemValueKey] as number) : -1))
        .filter((id) => id !== -1),
    )
  const handleDeselectAll = () => setSelected([])
  const filteredItems = items.filter((item) => {
    const value =
      searchKey === "name" && "name" in item && typeof item.name === "string"
        ? item.name
        : searchKey === "username" && "username" in item && typeof item.username === "string"
          ? item.username
          : ""
    return value.toLowerCase().includes(search.toLowerCase())
  })

  const handleItemToggle = (id: number) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((selectedId) => selectedId !== id))
    } else {
      setSelected([...selected, id])
    }
  }

  return (
    <Card className="flex-1 bg-card min-w-[280px]">
      {/* Header */}
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between mb-3">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Icon className="h-4 w-4 text-muted-foreground" />
            {title}
          </CardTitle>
        </div>
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="text-xs w-fit">
            {t("selectedCount", { count: selected.length, defaultValue: "{{count}} selected" })}
          </Badge>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs bg-transparent" onClick={handleSelectAll}>
              {selectAllLabel}
            </Button>
            <Button size="sm" variant="outline" className="h-6 px-2 text-xs bg-transparent" onClick={handleDeselectAll}>
              {deselectAllLabel}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Search */}
        <div className="relative" dir="ltr">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9 bg-background"
          />
        </div>

        {/* Items List */}
        <div className="space-y-1 max-h-[200px] overflow-y-auto" dir="ltr">
          {filteredItems.map((item) => {
            const id = typeof item[itemValueKey] === "number" ? (item[itemValueKey] as number) : undefined
            let label = ""
            if (itemLabelKey === "name" && "name" in item && typeof item.name === "string") label = item.name
            if (itemLabelKey === "username" && "username" in item && typeof item.username === "string")
              label = item.username
            if (id === undefined) return null

            const isSelected = selected.includes(id)

            return (
              <div
                key={id}
                onClick={() => handleItemToggle(id)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md cursor-pointer transition-colors hover:bg-accent",
                  isSelected && "bg-accent border border-primary",
                )}
              >
                <div className="relative">
                  <div
                    className={cn(
                      "w-4 h-4 rounded-full border-2 transition-colors",
                      isSelected ? "border-primary bg-primary" : "border-muted-foreground/30 bg-background",
                    )}
                  >
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-primary-foreground absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                    )}
                  </div>
                </div>
                <span className="text-sm truncate flex-1">{label}</span>
              </div>
            )
          })}
          {filteredItems.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              {t("noResults", { defaultValue: "No results found." })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
