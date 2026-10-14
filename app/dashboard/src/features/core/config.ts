export class CoreConfigError extends Error {
  constructor() { super("core.objectRequired"); this.name = "CoreConfigError"; }
}
export function parseCoreConfig(json: string): Record<string, unknown> {
  const body: unknown = JSON.parse(json);
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new CoreConfigError();
  return body as Record<string, unknown>;
}
