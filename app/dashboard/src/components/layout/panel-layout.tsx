import { Sidebar } from "@/components/layout/sidebar";
import useDirDetection from "@/hooks/use-dir-detection";
import { useSidebar } from "@/hooks/use-sidebar";
import { useStore } from "@/hooks/use-store";
import { cn } from "@/lib/utils";

export default function AdminPanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isRTL = useDirDetection() === "rtl";

  const sidebar = useStore(useSidebar, (x) => x);
  if (!sidebar) return null;
  const { getOpenState, settings } = sidebar;

  return (
    <>
      <Sidebar />
      <main
        className={cn(
          "min-h-[calc(100vh_-_56px)] bg-zinc-50 dark:bg-zinc-900 transition-[margin-left,margin-right] ease-in-out duration-300",
          !settings.disabled &&
            (!getOpenState()
              ? isRTL
                ? "lg:mr-[90px]"
                : "lg:ml-[90px]"
              : isRTL
              ? "lg:mr-60"
              : "lg:ml-60")
        )}
      >
        {children}
      </main>
      <footer
        className={cn(
          "transition-[margin-left,margin-right] ease-in-out duration-300",
          !settings.disabled &&
            (!getOpenState()
              ? isRTL
                ? "lg:mr-[90px]"
                : "lg:ml-[90px]"
              : isRTL
              ? "lg:mr-72"
              : "lg:ml-72")
        )}
      >
        {/* <Footer /> */}
      </footer>
    </>
  );
}
