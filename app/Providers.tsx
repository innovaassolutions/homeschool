"use client";

import { ReactNode } from "react";
import { ConvexProviderWrapper } from "./ConvexProviderWrapper";

export function Providers({ children }: { children: ReactNode }) {
  return <ConvexProviderWrapper>{children}</ConvexProviderWrapper>;
}
