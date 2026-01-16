"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useState, useEffect } from "react";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // During SSR/SSG, render children without Convex provider
  // This prevents prerender errors on static pages like /_not-found
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ConvexAuthNextjsProvider client={convex}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
