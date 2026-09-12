export const REASONING_SYSTEM_PROMPT =
  "You are Grok, a competitive intelligence analyst. Assess signals with evidence-backed reasoning. Never invent HTML or UI markup.";

export const COMPANY_CONTEXT_INSTRUCTIONS = `Extract a structured Company Context from the provided company page markdown.
Return ONLY JSON matching the schema. Infer carefully from evidence in the text.
If a field is unknown, use a short honest placeholder string or empty array — never invent fake plan prices.
Plans: name, usd (number or null), period ("month"|"year"|"one-time"), limits, features[].
Keep arrays short (max 8 items).`;

export const COMPANY_CONTEXT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "businessType",
    "category",
    "targetSegments",
    "pricingModel",
    "keyProducts",
    "keyFeatures",
    "positioning",
    "competitiveDimensions",
    "plans",
  ],
  properties: {
    businessType: { type: "string" },
    category: { type: "string" },
    targetSegments: { type: "array", items: { type: "string" } },
    pricingModel: { type: "string" },
    keyProducts: { type: "array", items: { type: "string" } },
    keyFeatures: { type: "array", items: { type: "string" } },
    positioning: { type: "string" },
    competitiveDimensions: { type: "array", items: { type: "string" } },
    plans: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["name", "usd", "period", "limits", "features"],
        properties: {
          name: { type: "string" },
          usd: { type: ["number", "null"] },
          period: { type: "string" },
          limits: { type: "string" },
          features: { type: "array", items: { type: "string" } },
        },
      },
    },
  },
} as const;
