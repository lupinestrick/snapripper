/**
 * Cookie 管理与快照本地持久化同步工具
 */

export function setCookie(name: string, value: string, days = 30): void {
  if (typeof document === "undefined") return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `; expires=${date.toUTCString()}`;
  document.cookie = `${name}=${value || ""}${expires}; path=/; SameSite=Lax`;
}

export function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const nameEQ = `${name}=`;
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

export function deleteCookie(name: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}

export const SNAPSHOT_COOKIE_KEYS = [
  "snapripper_has_cache",
  "snapripper_filename",
  "snapripper_tabs_count",
  "snapripper_last_saved",
] as const;

export function syncSnapshotCookie(fileName: string, tabCount: number): void {
  setCookie("snapripper_has_cache", "true", 30);
  setCookie("snapripper_filename", encodeURIComponent(fileName || "snapshot.json"), 30);
  setCookie("snapripper_tabs_count", String(tabCount), 30);
  setCookie("snapripper_last_saved", String(Date.now()), 30);
}

export function clearSnapshotCookies(): void {
  for (const key of SNAPSHOT_COOKIE_KEYS) {
    deleteCookie(key);
  }
}

export function getSnapshotCookieInfo(): {
  hasCache: boolean;
  fileName: string;
  tabCount: number;
  lastSaved: number;
} | null {
  const hasCache = getCookie("snapripper_has_cache");
  if (!hasCache) return null;
  const fileName = decodeURIComponent(getCookie("snapripper_filename") || "");
  const tabCount = parseInt(getCookie("snapripper_tabs_count") || "0", 10) || 0;
  const lastSaved = parseInt(getCookie("snapripper_last_saved") || "0", 10) || 0;
  return { hasCache: true, fileName, tabCount, lastSaved };
}
