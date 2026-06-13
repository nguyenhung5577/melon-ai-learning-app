"use client";

import { useState, useEffect } from "react";
import { auth } from "@/lib/auth/firebase";
import { Entitlements, Subscription } from "./types";

interface UseSubscriptionReturn {
  subscription: Subscription | null;
  entitlements: Entitlements | null;
  isPro: boolean;
  loading: boolean;
}

/**
 * Custom Hook: Giúp Frontend nhận biết User đang xài gói cước nào (Free hay Pro).
 * Tự động fetch lại khi trạng thái đăng nhập Firebase thay đổi.
 */
export function useSubscription(): UseSubscriptionReturn {
  const [data, setData] = useState<UseSubscriptionReturn>({
    subscription: null,
    entitlements: null,
    isPro: false,
    loading: true,
  });

  useEffect(() => {
    const unsubscribe = auth.onIdTokenChanged(async (user) => {
      if (!user) {
        setData({ subscription: null, entitlements: null, isPro: false, loading: false });
        return;
      }
      try {
        const token = await user.getIdToken();
        const res = await fetch("/api/v1/subscription/me", {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
           const json = await res.json();
           setData({ 
             subscription: json.subscription, 
             entitlements: json.entitlements, 
             isPro: json.isPro, 
             loading: false 
           });
        } else {
           setData({ subscription: null, entitlements: null, isPro: false, loading: false });
        }
      } catch (e) {
        setData({ subscription: null, entitlements: null, isPro: false, loading: false });
      }
    });
    return () => unsubscribe();
  }, []);

  return data;
}
