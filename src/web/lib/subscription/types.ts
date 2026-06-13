export type PlanType = "free" | "pro";
export type SubscriptionStatus = "active" | "inactive";

export interface Subscription {
  plan: PlanType;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
}

export interface Entitlements {
  maxChildren: number;
  canParseProblemsWithAI: boolean;
  canGenerateExercises: boolean;
}

// Quyền của gói Miễn phí
export const FREE_ENTITLEMENTS: Entitlements = {
  maxChildren: 2,
  canParseProblemsWithAI: false,
  canGenerateExercises: false,
};

// Quyền của gói Trả phí (Pro)
export const PRO_ENTITLEMENTS: Entitlements = {
  maxChildren: 5,
  canParseProblemsWithAI: true,
  canGenerateExercises: true,
};
