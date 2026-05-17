import { Component, type ErrorInfo, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <div className="max-w-md w-full border border-border rounded-lg p-6 text-center space-y-4">
            <h2 className="text-lg font-bold text-text-primary">Something went wrong</h2>
            <p className="text-xs text-text-secondary">
              {this.state.error?.message || 'An unexpected error occurred'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null })
                window.location.href = '/'
              }}
              className="px-4 py-2 text-xs bg-emerald-500/10 text-emerald-400 rounded hover:bg-emerald-500/20"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
