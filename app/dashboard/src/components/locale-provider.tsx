import { DirectionProvider } from "@base-ui/react/direction-provider";
import type { ReactNode } from "react";
import { useLocale } from "@/hooks/use-locale";

export function LocaleProvider({ children }: { children: ReactNode }) {
  const { direction } = useLocale();
  return <DirectionProvider direction={direction}>{children}</DirectionProvider>;
}
