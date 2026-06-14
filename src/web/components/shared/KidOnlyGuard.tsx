"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthContext } from "@/lib/auth/auth-context";

export function KidOnlyGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  const router = useRouter();
  const isBlocked = user?.role === "parent" || user?.role === "admin";

  useEffect(() => {
    if (!loading && isBlocked) {
      router.replace(user?.role === "admin" ? "/admin" : "/parent");
    }
  }, [isBlocked, loading, router, user?.role]);

  if (isBlocked) {
    return (
      <div className="px-6 py-16 text-center">
        <p className="font-display text-sm">Redirecting...</p>
      </div>
    );
  }

  return <>{children}</>;
}
