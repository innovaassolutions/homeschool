"use client";

import { ConvexClientProvider } from "./ConvexClientProvider";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  // Always render ConvexClientProvider - it handles SSR internally
  // The children need to be wrapped in the provider so hooks work
  return <ConvexClientProvider>{children}</ConvexClientProvider>;
}
