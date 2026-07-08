"use client";

import dynamic from "next/dynamic";
import React, { Suspense } from "react";

/**
 * lazyPage — wrap an admin page in dynamic() with a loading fallback.
 * 
 * Usage in page.tsx files:
 *   export default lazyPage(() => import("./_content/PageContent"));
 * 
 * Or as a HOC at the route level:
 *   const HeavyPage = lazyPage(() => import("./heavy-component"));
 * 
 * This reduces the initial JS bundle by code-splitting each route into its
 * own chunk, loaded only when the user navigates there. Particularly important
 * for the static-export build where all pages are bundled together.
 */

function PageSkeleton() {
  return (
    <div className="flex-1 p-6 space-y-4">
      <div className="h-8 w-48 bg-white/5 rounded-lg animate-pulse" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 bg-white/5 rounded-xl animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-white/5 rounded-xl animate-pulse" />
    </div>
  );
}

export function lazyPage<T extends object>(
  importFn: () => Promise<{ default: React.ComponentType<T> }>,
) {
  const DynamicComponent = dynamic(importFn, {
    loading: () => <PageSkeleton />,
    ssr: false, // Admin pages are client-only (static export)
  });

  return function LazyPage(props: T) {
    return (
      <Suspense fallback={<PageSkeleton />}>
        <DynamicComponent {...props} />
      </Suspense>
    );
  };
}
