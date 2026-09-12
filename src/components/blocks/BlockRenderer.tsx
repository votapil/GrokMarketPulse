import { useQuery } from "convex/react";
import type { Id } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import { fixtureLayout, fixtureSignal } from "@/lib/fixtures";
import type { BlockType, UiBlock } from "@/lib/types";
import {
  blockRegistry,
  defaultLayoutForSignal,
  isFixtureId,
  UnsupportedBlock,
} from "./registry";

export type BlockRendererProps = {
  signalId: string;
};

function resolveBlockComponent(type: string) {
  if (Object.prototype.hasOwnProperty.call(blockRegistry, type)) {
    return blockRegistry[type as BlockType];
  }
  return null;
}

function useLayoutBlocks(signalId: string): UiBlock[] | undefined {
  const isFixture = isFixtureId(signalId);
  const convexLayout = useQuery(
    api.signals.layout,
    !isFixture ? { signalId: signalId as Id<"signals"> } : "skip",
  );

  if (isFixture) {
    if (signalId === fixtureSignal.id) {
      return fixtureLayout;
    }
    return defaultLayoutForSignal(signalId);
  }

  if (convexLayout === undefined) {
    return undefined;
  }

  if (convexLayout.length === 0) {
    return defaultLayoutForSignal(signalId);
  }

  return convexLayout as UiBlock[];
}

function renderBlocks(blocks: UiBlock[]) {
  return blocks.map((block) => {
    const Component = resolveBlockComponent(block.type);
    if (!Component) {
      return <UnsupportedBlock key={block.id} type={String(block.type)} />;
    }
    return <Component key={block.id} block={block} />;
  });
}

export function BlockRenderer({ signalId }: BlockRendererProps) {
  const blocks = useLayoutBlocks(signalId);

  if (blocks === undefined) {
    return (
      <div
        className="space-y-[var(--space-4,16px)]"
        aria-busy="true"
        aria-label="Loading workspace blocks"
      >
        {renderBlocks(defaultLayoutForSignal(signalId))}
      </div>
    );
  }

  return (
    <div
      className="space-y-[var(--space-4,16px)]"
      aria-label="Signal workspace"
    >
      {renderBlocks(blocks)}
    </div>
  );
}
