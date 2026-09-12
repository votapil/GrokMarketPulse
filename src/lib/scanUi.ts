export function canStartScan(
  competitorId: string | null | undefined,
  isScanning: boolean,
): boolean {
  return competitorId != null && competitorId !== "" && !isScanning;
}

export function scanButtonTitle(input: {
  hasCompetitor: boolean;
  isScanning: boolean;
}): string {
  if (!input.hasCompetitor) {
    return "Waiting for workspace competitor";
  }
  if (input.isScanning) {
    return "Scan in progress";
  }
  return "Run Scan";
}
