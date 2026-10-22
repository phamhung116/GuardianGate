"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTideCloak } from "@tidecloak/nextjs";
import { storeAccessToken } from "@/app/auth/token-cookie";

export default function AuthRedirectPage() {
  const { authenticated, isInitializing, token, tokenExp } = useTideCloak();
  const router = useRouter();

  useEffect(() => {
    if (isInitializing) return;
    if (authenticated && token) storeAccessToken(token, tokenExp);
    router.replace("/auth/login");
  }, [authenticated, isInitializing, token, tokenExp, router]);

  return <p style={{ padding: 32 }}>Completing TideCloak sign-in…</p>;
}
