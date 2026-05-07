"use client";

import { useAuth } from "@/lib/auth/use-auth";

type Role = "kid" | "parent" | "admin";

interface ProtectedActionProps {
  roles?: Role[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Renders children only if the current user has one of the required roles.
 * Falls back to null (or custom fallback) if unauthorized.
 */
export function ProtectedAction({
  roles,
  children,
  fallback = null,
}: ProtectedActionProps) {
  const { user } = useAuth();

  if (!user) return <>{fallback}</>;
  if (roles && !roles.includes(user.role as Role)) return <>{fallback}</>;

  return <>{children}</>;
}
