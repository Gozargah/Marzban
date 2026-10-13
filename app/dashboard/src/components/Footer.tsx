import type { ComponentProps } from "react";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { ORGANIZATION_URL, REPO_URL } from "constants/Project";
import { $fetch } from "service/http";

export function Footer({ className, ...props }: ComponentProps<"footer">) {
  const { data } = useQuery({
    queryKey: ["app-version"],
    queryFn: ({ signal }) =>
      $fetch<{ version: string }>("/version", { signal, retry: 0 }),
    staleTime: Infinity,
    retry: false,
  });
  const version = data?.version;
  return (
    <footer
      className={cn("relative w-full text-center text-xs text-muted-foreground", className)}
      {...props}
    >
      <p>
        <a
          className="rounded-sm text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={REPO_URL}
        >
          Marzban
        </a>
        {version ? <> (<bdi>v{version}</bdi>), </> : ", "}
        Made with <span role="img" aria-label="love">❤️</span> in{" "}
        <a
          className="rounded-sm text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          href={ORGANIZATION_URL}
        >
          Gozargah
        </a>
      </p>
    </footer>
  );
}
