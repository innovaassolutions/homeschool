"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode, useRef } from "react";

// Lazy singleton - only created on first client-side render
let convexClient: ConvexReactClient | null = null;

function getConvexClient(): ConvexReactClient {
  if (convexClient === null) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is not set");
    }
    convexClient = new ConvexReactClient(url);
  }
  return convexClient;
}

export function ConvexClientProvider({ children }: { children: ReactNode }) {
  // Use ref to ensure we get the same client instance
  const clientRef = useRef<ConvexReactClient | null>(null);
  if (clientRef.current === null) {
    clientRef.current = getConvexClient();
  }

  return (
    <ConvexAuthNextjsProvider client={clientRef.current}>
      {children}
    </ConvexAuthNextjsProvider>
  );
}
