import { ChevronLeft } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { useEffect, useState } from "react";

interface SidebarToggleProps {
  isOpen: boolean | undefined;
  setIsOpen?: () => void;
}

export function SidebarToggle({ isOpen, setIsOpen }: SidebarToggleProps) {
  const { i18n } = useTranslation();
  const [isRTL, setIsRTL] = useState<boolean>(i18n.dir() === "rtl");

  useEffect(() => {
    if (i18n.dir() === "rtl") setIsRTL(true);
    else setIsRTL(false);
  }, [i18n.language]);

  return (
    <div
      className={cn(
        "invisible lg:visible absolute top-[12px] z-20 transition-transform ease-in-out duration-300",
        isRTL ? "-left-[16px]" : "-right-[16px]"
      )}
    >
      <Button
        onClick={() => setIsOpen?.()}
        className="rounded-md w-8 h-8"
        variant="outline"
        size="icon"
      >
        <ChevronLeft
          className={cn(
            "h-4 w-4 transition-transform ease-in-out duration-700",
            isRTL
              ? isOpen === false
                ? "rotate-0"
                : "rotate-180" 
              : isOpen === false
              ? "rotate-180"
              : "rotate-0" 
          )}
        />
      </Button>
    </div>
  );
}
