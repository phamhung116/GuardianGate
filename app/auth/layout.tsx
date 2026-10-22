"use client";

import { TideCloakProvider } from "@tidecloak/nextjs";
import adapter from "@/tidecloakAdapter.json";

// Only /auth/* loads the TideCloak SDK, so the persona-based demo keeps working when
// TideCloak is offline or enrollment is not finished yet.
export default function AuthLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <TideCloakProvider config={adapter}>{children}</TideCloakProvider>;
}
