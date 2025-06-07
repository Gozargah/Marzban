export function isEmptyObject(obj: Record<string, any> | null | undefined): boolean {
    if (!obj) return false;
    return Object.keys(obj).length === 0 && obj.constructor === Object;
}