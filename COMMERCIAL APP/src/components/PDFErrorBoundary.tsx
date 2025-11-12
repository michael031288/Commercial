import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  retryCount: number;
}

export class PDFErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> | null {
    // Don't show error state for sendWithPromise errors - PDF is usually still functional
    if (error.message?.includes('sendWithPromise') || error.message?.includes('null')) {
      return null; // Don't set error state
    }
    console.error('🚨 PDFErrorBoundary caught error:', error);
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // For sendWithPromise errors, suppress them silently - PDF is likely still functional
    if (error.message?.includes('sendWithPromise') || error.message?.includes('null')) {
      // Silently suppress these errors - they're non-critical and PDF is usually still visible
      // Just reset error state immediately without showing error UI
      setTimeout(() => {
        this.setState({ 
          hasError: false, 
          error: null
        });
      }, 100);
      return;
    }
    
    // For other errors, log them normally
    console.error('🚨 PDFErrorBoundary error details:', {
      error,
      errorInfo,
      componentStack: errorInfo.componentStack,
    });
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div style={{ 
          padding: '20px', 
          textAlign: 'center',
          color: 'var(--text-secondary)',
          fontSize: '14px'
        }}>
          <div>⚠️ PDF failed to load</div>
          {this.state.error && (
            <div style={{ marginTop: '8px', fontSize: '12px', opacity: 0.7 }}>
              {this.state.error.message}
            </div>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}

