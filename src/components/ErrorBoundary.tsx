import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}
interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, message: error instanceof Error ? error.message : String(error) };
  }

  handleReset = () => {
    this.setState({ hasError: false, message: '' });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg-0)' }}>
          <div className="surface max-w-md w-full p-8 text-center">
            <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-0)' }}>Something went wrong</h2>
            <p className="text-sm mb-1" style={{ color: 'var(--text-2)' }}>The screen failed to render.</p>
            {this.state.message && (
              <p className="text-xs font-mono mb-5 break-words" style={{ color: 'var(--text-3)' }}>{this.state.message}</p>
            )}
            <div className="flex gap-2 justify-center">
              <button className="btn-primary" onClick={() => window.location.reload()}>Reload app</button>
              <button className="btn-ghost" onClick={this.handleReset}>Try again</button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
