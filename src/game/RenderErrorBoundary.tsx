import { Component, type ErrorInfo, type ReactNode } from 'react';

type RenderErrorBoundaryProps = {
  children: ReactNode;
};

type RenderErrorBoundaryState = {
  error?: Error;
};

export class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  state: RenderErrorBoundaryState = {};

  static getDerivedStateFromError(error: Error): RenderErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('3D renderer failed', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="renderer-fallback">
          <h2>3D renderer unavailable</h2>
          <p>{this.state.error.message}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
