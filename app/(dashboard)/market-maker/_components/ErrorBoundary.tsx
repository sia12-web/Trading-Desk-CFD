'use client'

import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="p-6 border border-red-900/50 bg-red-900/10 rounded-lg">
          <h2 className="text-red-400 font-bold mb-2">Something went wrong</h2>
          <pre className="text-xs text-red-300/70 overflow-auto max-h-[200px]">
            {this.state.error?.message}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="mt-4 px-3 py-1 bg-red-500 text-white rounded text-xs"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
