/**
 * /memory → /journey/memory redirect.
 *
 * F01 shipped a thin testable /memory surface (2026-04-25) so check-ins
 * could be exercised end-to-end before F02 C1 landed. F02 C1 now ships
 * the canonical Memory tab inside Journey at /journey/memory; this route
 * is preserved as a permanent redirect so existing bookmarks / deep
 * links don't break.
 */
import { redirect } from 'next/navigation'

export default function MemoryRedirect(): never {
  redirect('/journey/memory')
}
