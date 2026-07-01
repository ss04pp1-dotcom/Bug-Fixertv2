"use client";

import { ReactQueryProvider } from "@/providers/ReactQueryProvider";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <ReactQueryProvider>{children}</ReactQueryProvider>;
}