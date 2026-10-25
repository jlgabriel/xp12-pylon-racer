/**
 * May the window navigate to this URL? The app is a single page that never legitimately navigates;
 * the one exception is Vite's dev server reloading its own origin.
 *
 * Never compare the target's origin with the current page's: in a packaged build the page is a
 * file:// URL, every file:// URL has origin "null", and "null" === "null" would let a dropped .html
 * file load with the preload attached.
 */
export function mayNavigate(target: string, devServerUrl: string | undefined): boolean {
  if (!devServerUrl) return false;
  try {
    const url = new URL(target);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.origin === new URL(devServerUrl).origin;
  } catch {
    return false;
  }
}
