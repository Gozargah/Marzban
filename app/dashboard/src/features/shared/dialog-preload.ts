/** Share in-flight imports, and allow another attempt after a failed download. */
export function createPreloader(load: () => Promise<unknown>) {
  let pending: Promise<unknown> | undefined;
  return () => {
    if (!pending) pending = load().catch(() => { pending = undefined; });
    return pending;
  };
}
export const preloadEditor = createPreloader(() => import("@/components/JsonEditor"));
export const preloadTrafficChart = createPreloader(() => import("./traffic-chart"));
