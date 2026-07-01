import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? (isProduction ? "" : "/admin");

const nextConfig: NextConfig = {
  basePath,
  trailingSlash: true,
  // D-003 fix: do NOT silence ESLint or TypeScript errors during build.
  // Hiding these errors let real bugs ship. If the build fails, fix the
  // reported issues rather than bypassing the checks.
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ["*.pike.replit.dev", "*.sisko.replit.dev", "*.replit.dev", "*.repl.co"],
  // Static export for Cloudflare Pages deployment — all admin logic must be
  // client-side. Server components, API routes, and middleware are not available.
  // To disable static export (e.g. for a Node.js host), remove this line and
  // set output: "standalone" instead.
  ...(isProduction && { output: "export" }),
};

export default nextConfig;
