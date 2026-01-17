"use client";

import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
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

  // Use ConvexProvider for core Convex functionality (useConvexAuth, useQuery, etc.)
  // Use ConvexAuthProvider for auth actions (signIn, signOut)
  return (
    <ConvexProvider client={client}>
      <ConvexAuthProvider client={client}>
        {children}
      </ConvexAuthProvider>
    </ConvexProvider>
  );
}
