import { Component, type ErrorInfo, type ReactNode } from "react";

export class ErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Vox UI error", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="flex h-full w-full flex-col items-center justify-center gap-4 bg-background p-8 text-center text-foreground">
        <h1 className="font-heading text-2xl">Something went wrong</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Vox hit an unexpected problem showing this screen. Your data is safe.
        </p>
        <button
          type="button"
          className="rounded-md bg-white px-4 py-2 text-sm font-medium text-black"
          onClick={() => window.location.reload()}
        >
          Reload Vox
        </button>
      </main>
    );
  }
}
