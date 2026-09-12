export type LandingPayload = {
  type: "landing";
  headline: string;
  subheadline: string;
  offer: string;
  benefits: { title: string; body: string }[];
  differentiation: string;
  comparison: { feature: string; us: string; them: string }[];
  socialProofPlaceholders: string[];
  cta: string;
  sections: { title: string; body: string }[];
};

export type LocalLandingEdits = {
  headline?: string;
  cta?: string;
};

export function heroImageAlt(headline: string): string {
  const trimmed = headline.trim();
  return trimmed ? `${trimmed} — hero` : "Landing page hero";
}

export function withLocalLandingEdits(
  payload: LandingPayload,
  edits: LocalLandingEdits,
): LandingPayload {
  return {
    ...payload,
    headline: edits.headline ?? payload.headline,
    cta: edits.cta ?? payload.cta,
  };
}
