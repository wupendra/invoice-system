/**
 * Produces a filesystem-safe slug from a free-text name.
 * "Kaju Art Rugs Pvt. Ltd." → "kaju-art-rugs-pvt-ltd"
 * Empty or punctuation-only inputs return the literal 'invoice' so download
 * URLs never collapse to a bare `-YYYY-MM-DD.pdf`.
 */
export function slugify(s: string): string {
  const out = (s ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return out || 'invoice';
}
