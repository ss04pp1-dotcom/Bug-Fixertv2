"use client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ErrorBoundary from "@/components/ErrorBoundary";

// D-004 note: this layout ships as part of a static export (`output: "export"`).
// middleware.ts only protects `next dev`, not the deployed bundle. Real
// protection is API-side — every admin endpoint requires a JWT, and the 401
// interceptor in lib/axios-client.ts redirects to /login on auth failure.
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <DashboardLayout>{children}</DashboardLayout>
    </ErrorBoundary>
  );
}
