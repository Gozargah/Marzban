import { Navbar } from "@/components/layout/navbar";

interface ContentLayoutProps {
  children: React.ReactNode;
  className?: string;
}

export function ContentLayout({ children,className }: ContentLayoutProps) {
  return (
    <div>
      <Navbar />
      <div className={className}>{children}</div>
    </div>
  );
}
