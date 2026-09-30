import type { Metadata } from "next";
import type { ReactNode } from "react";

/**
 * Gated authentication surface — never indexable.
 *
 * `app/robots.txt/route.ts` lists this path under `Disallow`, but robots.txt is
 * advisory only: a page can still be crawled and indexed from inbound links.
 * The authoritative signal is the meta robots tag, and without it Search Console
 * reports these as "Indexed, though blocked by robots.txt" — which competes with
 * `/` in results. See `instruction.md` §7 and `NEW_PROJECT_CHECKLIST.md` §5.
 *
 * This replaced a sibling `metadata.ts` that was dead code — Next.js only reads
 * `layout.tsx` / `page.tsx` exports and nothing imported that file, so its
 * title/description/FAQ never reached the document. That file has since been
 * removed; this layout is what applies the directive.
 */
export const metadata: Metadata = {
  alternates: { canonical: null },
  robots: { index: false, follow: false },
};

export default function GatedLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
