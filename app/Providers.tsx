"use client";

import dynamic from "next/dynamic";
import { ReactNode } from "react";

// Dynamically import ConvexClientProvider with SSR disabled
// This prevents Convex hooks from running during static page generation
const ConvexClientProvider = dynamic(
  () => import("./ConvexClientProvider").then((mod) => mod.ConvexClientProvider),
  {
    ssr: false,
    loading: () => (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{
          width: 32,
          height: 32,
          border: "2px solid #e5e7eb",
          borderTopColor: "#3b82f6",
          borderRadius: "50%",
          animation: "spin 1s linear infinite"
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    ),
  }
);

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
