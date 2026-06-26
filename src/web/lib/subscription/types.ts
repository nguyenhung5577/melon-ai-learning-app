export type PlanType = "free" | "pro";
export type SubscriptionStatus = "active" | "inactive";

export interface Subscription {
  plan: PlanType;
  status: SubscriptionStatus;
  startedAt: string;
  expiresAt: string | null;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: string | null;
  cancelAtPeriodEnd?: boolean;
  updatedAt?: string;
}

export interface Entitlements {
  maxChildren: number;
  canParseProblemsWithAI: boolean;
  canGenerateExercises: boolean;
  aiCoaching: boolean;
}

// Quyền của gói Miễn phí
export const FREE_ENTITLEMENTS: Entitlements = {
  maxChildren: 2,
  canParseProblemsWithAI: false,
  canGenerateExercises: false,
  aiCoaching: false,
};

// Quyền của gói Trả phí (Pro)
export const PRO_ENTITLEMENTS: Entitlements = {
  maxChildren: 999, // Không giới hạn
  canParseProblemsWithAI: true,
  canGenerateExercises: true,
  aiCoaching: true,
};
