import { Component, ReactNode, ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('React error boundary caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-8">
          <div className="bg-white rounded-xl shadow-sm border border-red-100 p-8 max-w-lg w-full">
            <h1 className="text-xl font-bold text-red-700 mb-2">Something went wrong</h1>
            <p className="text-sm text-gray-600 mb-4">
              An unexpected error occurred. Please refresh the page to try again.
            </p>
            {this.state.error && (
              <pre className="bg-gray-50 border border-gray-200 rounded p-3 text-xs text-gray-700 overflow-auto max-h-40">
                {this.state.error.message}
              </pre>
            )}
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-[#1e3a5f] text-white text-sm font-semibold rounded-lg hover:bg-[#162d4a] transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
