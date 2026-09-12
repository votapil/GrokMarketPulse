import type { LoadState } from "./types";

export type PricingPlan = {
  name: string;
  usd: number | null;
  period: string;
  limits: string;
  features: string[];
};

export type CompanyPricing = {
  companyName: string;
  plans: PricingPlan[];
  keyFeatures: string[];
  fromConvex: boolean;
};

export type CompanyContextInput = {
  kind: "convex" | "fixture";
  companyName: string;
  contextStatus: "ready" | "pending" | "error" | "empty";
  error: string | null;
  context: {
    plans: readonly PricingPlan[];
    keyFeatures: readonly string[];
  } | null;
};

function copyPlans(plans: readonly PricingPlan[]): PricingPlan[] {
  return plans.map((plan) => ({
    ...plan,
    features: [...plan.features],
  }));
}

/**
 * Company pricing for compare blocks. Context with zero plans is still
 * ready — FeatureMatrix can use keyFeatures. DataGrid treats zero plans
 * as its own empty state.
 */
export function resolveCompanyPricing(
  input: CompanyContextInput,
): LoadState<CompanyPricing> {
  if (input.contextStatus === "error") {
    return {
      kind: "error",
      message: input.error ?? "Company context could not be analysed",
    };
  }

  if (input.contextStatus === "pending") {
    return { kind: "loading" };
  }

  if (!input.context) {
    return { kind: "empty" };
  }

  return {
    kind: "ready",
    data: {
      companyName: input.companyName,
      plans: copyPlans(input.context.plans),
      keyFeatures: [...input.context.keyFeatures],
      fromConvex: input.kind === "convex",
    },
  };
}
