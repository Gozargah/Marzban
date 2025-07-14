import { ChevronLeft } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import useDirDetection from '@/hooks/use-dir-detection'

interface SidebarToggleProps {
  isOpen: boolean | undefined
  setIsOpen?: () => void
}

export function SidebarToggle({ isOpen, setIsOpen }: SidebarToggleProps) {
  const isRTL = useDirDetection() === 'rtl'

  return (
    <div className={cn('invisible absolute top-[12px] z-20 transition-transform duration-300 ease-in-out lg:visible', isRTL ? '-left-[16px]' : '-right-[16px]')}>
      <Button onClick={() => setIsOpen?.()} className="h-8 w-8 rounded-md" variant="outline" size="icon">
        <ChevronLeft className={cn('h-4 w-4 transition-transform duration-700 ease-in-out', isRTL ? (isOpen === false ? 'rotate-0' : 'rotate-180') : isOpen === false ? 'rotate-180' : 'rotate-0')} />
      </Button>
    </div>
  )
}
