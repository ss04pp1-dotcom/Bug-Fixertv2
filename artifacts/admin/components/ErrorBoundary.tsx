'use client';
import React from 'react';

interface Props { children: React.ReactNode }
interface State { hasError: boolean; error: Error | null; retryKey: number }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null, retryKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  // D-046 fix: bump retryKey so the children wrapper remounts, forcing
  // downstream components to re-initialise instead of staying in a
  // crashed state after the user clicks "Try Again".
  handleRetry = () => {
    this.setState({ hasError: false, error: null, retryKey: this.state.retryKey + 1 });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070F] flex items-center justify-center p-8">
          <div className="bg-[#121A2F] rounded-2xl p-8 max-w-md w-full text-center border border-[#1C1C2A]">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-[#8B92A5] text-sm mb-6">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={this.handleRetry} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium">
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return <div key={this.state.retryKey}>{this.props.children}</div>;
  }
}
export default ErrorBoundary;
