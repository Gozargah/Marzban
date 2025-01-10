import LogoIcon from '@/assets/logo.svg?react'
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from '@/components/ui/drawer'
import { Equal } from 'lucide-react'
import { useState } from 'react'
import { Menu } from './menu'

export function MobileDrawer() {
  const [open, setOpen] = useState(false)

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger className="lg:hidden" asChild>
        <Equal />
      </DrawerTrigger>
      <DrawerContent>
        {/* Fixed Header */}
        <DrawerHeader className="sticky top-0 z-10 bg-background">
          <DrawerTitle className="flex items-center justify-center gap-x-2 mt-1">
            <div className="w-5 h-5">
              <LogoIcon />
            </div>
            <span>Marzban</span>
          </DrawerTitle>
        </DrawerHeader>

        {/* Scrollable Content */}
        <div
          className="h-[50vh] overflow-y-auto px-4 py-2"
          style={{
            WebkitOverflowScrolling: 'touch', // Smooth scrolling on iOS
          }}
        >
          <Menu isOpen />
        </div>
      </DrawerContent>
    </Drawer>
  )
}
