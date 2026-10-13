"use client";

import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/AuthContext";

// layout.tsx är en server-komponent (den exporterar metadata), så
// AuthProvider kan inte läggas rakt in där. Den klient-markerade
// wrappern här gör jobbet istället.
export function Providers({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
