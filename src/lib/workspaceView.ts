export type WorkspacePlan = {
  name: string;
  usd: number | null;
};

/** Header plaque: never invents "Pro $45" when Convex has no priced plan. */
export function workspacePlanLabel(plans: readonly WorkspacePlan[]): string {
  const priced = plans.filter((plan) => plan.usd != null);
  const namedPro = priced.find((plan) => /pro/i.test(plan.name));
  const plan = namedPro ?? priced[0] ?? plans[0];
  if (!plan) {
    return "No listed plans";
  }
  if (plan.usd == null) {
    return plan.name;
  }
  return `${plan.name} $${plan.usd}`;
}

export function workspaceSegment(segments: readonly string[] | undefined): string {
  return segments?.[0] ?? "—";
}
