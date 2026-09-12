import { PulseScreen } from "@/screens/PulseScreen";

/**
 * Shell mount for `/` (track B T-05). Body is track A T-15 PulseScreen.
 * Importer: App.tsx route `/`. During T-15 handoff B does not edit this file.
 */
export function PulsePage() {
  return <PulseScreen />;
}
