'use client';
import React from 'react';

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; error?: Error }> {
  state = { hasError: false, error: undefined as Error | undefined };
  static getDerivedStateFromError(error: Error) { return { hasError: true, error }; }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#05070F] flex items-center justify-center p-8">
          <div className="bg-[#121A2F] rounded-2xl p-8 max-w-md w-full text-center border border-[#1C1C2A]">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
            <p className="text-[#8B92A5] text-sm mb-6">{this.state.error?.message || 'An unexpected error occurred'}</p>
            <button onClick={() => this.setState({ hasError: false })} className="px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium">
              Try Again
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
export default ErrorBoundary;