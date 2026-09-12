import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = { children: ReactNode };
type State = { message: string | null; stack: string | null };

/**
 * Корневой ловчик: без него падение блока после прихода Convex
 * опустошает #root и ведущий видит чёрный экран.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { message: null, stack: null };

  static getDerivedStateFromError(error: Error): State {
    return {
      message: error.message || "Something went wrong",
      stack: error.stack ?? null,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("App ErrorBoundary", error, info.componentStack);
  }

  render() {
    if (this.state.message === null) {
      return this.props.children;
    }

    return (
      <div
        role="alert"
        className="m-[var(--space-4)] rounded-[var(--radius-md)] border border-[var(--palette-accent)] bg-[var(--color-surface)] p-[var(--space-4)]"
      >
        <p className="font-[family-name:var(--font-sans)] text-[16px] font-[number:var(--weight-bold)] text-[var(--color-text)]">
          {this.state.message}
        </p>
        {this.state.stack ? (
          <pre className="mt-[var(--space-3)] max-h-[40vh] overflow-auto font-[family-name:var(--font-mono)] text-[11px] text-[var(--color-text-muted)]">
            {this.state.stack}
          </pre>
        ) : null}
        <button
          type="button"
          className="mt-[var(--space-3)] rounded-[var(--radius-md)] border border-[var(--color-border)] px-[var(--space-3)] py-[var(--space-2)] font-[family-name:var(--font-sans)] text-[13px] text-[var(--color-text)]"
          onClick={() => this.setState({ message: null, stack: null })}
        >
          Try again
        </button>
      </div>
    );
  }
}
