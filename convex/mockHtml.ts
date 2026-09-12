export const MOCK_SLUG = "acmeflow";
export const MOCK_PRICING_PATH = "/mock/acmeflow/pricing";

export type MockVariant = "v1" | "v2";

export type MockPlan = {
  name: string;
  usd: number;
  period: string;
  limits: string;
  features: string[];
};

export function mockPlans(variant: MockVariant): MockPlan[] {
  const proUsd = variant === "v2" ? 39 : 49;
  const proFeatures =
    variant === "v2"
      ? ["AI inbox", "5 seats", "Email + chat", "Free migration from any helpdesk"]
      : ["AI inbox", "5 seats", "Email + chat"];

  return [
    {
      name: "Starter",
      usd: 19,
      period: "month",
      limits: "2 seats",
      features: ["Email inbox", "Basic macros"],
    },
    {
      name: "Pro",
      usd: proUsd,
      period: "month",
      limits: "5 seats",
      features: proFeatures,
    },
    {
      name: "Business",
      usd: 99,
      period: "month",
      limits: "Unlimited seats",
      features: ["SSO", "SLA", "Audit log"],
    },
  ];
}

export function mockPricingUrl(siteUrl: string): string {
  if (!siteUrl) {
    throw new Error("CONVEX_SITE_URL is not set");
  }
  return `${siteUrl.replace(/\/$/, "")}${MOCK_PRICING_PATH}`;
}

export function renderMockPricingHtml(variant: MockVariant): string {
  const plans = mockPlans(variant);
  const cards = plans
    .map((plan) => {
      const extras = plan.features
        .map((feature) => `<li>${escapeHtml(feature)}</li>`)
        .join("");
      return `<article>
  <h2>${escapeHtml(plan.name)}</h2>
  <p class="price">$${plan.usd} / ${escapeHtml(plan.period)}</p>
  <p class="limits">${escapeHtml(plan.limits)}</p>
  <ul>${extras}</ul>
</article>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>AcmeFlow Pricing — demo fixture</title>
</head>
<body>
<!-- demo fixture site for Market Pulse -->
<h1>AcmeFlow Pricing (demo fixture)</h1>
<p>This is a Market Pulse demo fixture, not a real product page.</p>
<main>
${cards}
</main>
</body>
</html>
`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
