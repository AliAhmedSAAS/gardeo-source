/**
 * Sanitize a single filename segment so it is safe to embed in a
 * Content-Disposition HTTP header.
 *
 * Strips non-ASCII characters (e.g. en-dashes from period labels) and
 * characters that are invalid in filenames or unsafe in HTTP headers,
 * collapsing them to single hyphens. Prevents 500 errors caused by
 * invalid Content-Disposition header values.
 */
export function safeFilename(segment: string): string {
  return String(segment ?? "")
    .replace(/[^\x20-\x7E]/g, "-")
    .replace(/[<>:"\/\\|?*]/g, "-")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}
