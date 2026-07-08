"use client";

import { useEffect, useState } from "react";

/**
 * NoSSR — defer rendering until after hydration to prevent SSR/client mismatch.
 *
 * In a static-export Next.js app (output: "export"), all pages are rendered
 * client-side anyway, but components that read browser-only APIs (localStorage,
 * window, etc.) will still cause React hydration warnings if they render during
 * the first pass.
 *
 * This wrapper suppresses the first render, replacing it with `fallback`.
 * Pass a stable skeleton as `fallback` to prevent layout shift (CLS).
 *
 * Usage:
 *   <NoSSR fallback={<Skeleton />}>
 *     <BrowserOnlyComponent />
 *   </NoSSR>
 */
export function NoSSR({
  children,
  fallback = null,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR / first render: show fallback (stable shape → no CLS).
  // After hydration: show real content.
  if (!mounted) return <>{fallback}</>;
  return <>{children}</>;
}
