import { ModeToggle } from "@/components/mode-toggle";
import { MobileDrawer } from "@/components/layout/mobile-drawer";
import { Language } from "../Language";

export function Navbar() {
  return (
    <header className="sticky top-0 z-10 w-full bg-background/95 shadow backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:shadow-secondary">
      <div className="mx-4 sm:mx-8 flex h-14 items-center">
        <div className="flex items-center space-x-4 lg:space-x-0">
          <MobileDrawer />
          <h1 className="font-bold"></h1>
        </div>
        <div className="flex flex-1 items-center justify-end">
          <ModeToggle />
          <Language />
          {/* <UserNav /> */}
        </div>
      </div>
    </header>
  );
}
