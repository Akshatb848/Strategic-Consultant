"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/contexts/AuthContext";
import { bootstrapSession, clearAccessToken, setAccessToken } from "@/lib/api";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    const completeOAuth = async () => {
      const error = searchParams.get("error");
      if (error) {
        clearAccessToken();
        router.replace(`/login?error=${error}`);
        return;
      }

      const token = searchParams.get("token");
      if (token) {
        setAccessToken(token);
      }

      const user = await bootstrapSession().catch(() => null);
      if (!user) {
        router.replace("/login?error=oauth_failed");
        return;
      }

      await refreshUser();
      router.replace("/dashboard");
    };

    void completeOAuth();
  }, [refreshUser, router, searchParams]);

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16, background: "#070b14", color: "#94a3b8", fontSize: 14 }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#6366f1", animation: "spin 0.8s linear infinite" }} />
      Completing sign-in...
    </div>
  );
}
