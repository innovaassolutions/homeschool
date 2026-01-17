"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

// Singleton client - only exists on client side
let convexClient: ConvexReactClient | null = null;

function getClient(): ConvexReactClient {
  if (!convexClient) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) {
      throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    }
    convexClient = new ConvexReactClient(url);
  }
  return convexClient;
}

export function ConvexProviderWrapper({ children }: { children: ReactNode }) {
  const client = getClient();

  // ConvexAuthProvider provides both auth functionality AND the Convex context
  return (
    <ConvexAuthProvider client={client}>
      {children}
    </ConvexAuthProvider>
  );
}
