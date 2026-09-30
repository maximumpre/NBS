import type { Metadata } from "next";

/**
 * 404 for this site.
 *
 * Without this file Next renders its built-in not-found, which stacks its own
 * `noindex` meta on top of the root layout's `index, follow` — leaving one
 * document with two contradictory robots tags plus a `googlebot: index, follow`
 * and a canonical pointing at the homepage. A canonical to `/` on a 404 is the
 * classic soft-404 signal, so this page states a single, unambiguous directive
 * and claims no canonical at all.
 */
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  alternates: {},
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl font-medium text-gray-800">Page not found</h1>
      <p className="mt-3 text-[15px] text-gray-600">
        The page you are looking for is not available.
      </p>
      <a
        href="/"
        className="mt-6 text-[15px] text-[#254650] underline"
      >
        Return to sign in
      </a>
    </main>
  );
}
