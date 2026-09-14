import React from 'react';

interface State {
  hasError: boolean;
  error?: Error;
  componentStack?: string;
}

/**
 * Global error boundary: prevents a white screen when a render error
 * (e.g. "Rendered fewer hooks than expected") escapes a component,
 * and records the React component stack so the culprit can be identified.
 */
export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    const componentStack = info?.componentStack || '';
    console.error('[AppErrorBoundary] Render error:', error?.message, '\nComponent stack:', componentStack);
    try {
      localStorage.setItem(
        'app.last_render_error.v1',
        JSON.stringify({ at: Date.now(), message: error?.message, componentStack: componentStack.slice(0, 4000) })
      );
    } catch { /* ignore */ }
    this.setState({ componentStack });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <h2 className="text-xl font-arabic font-bold text-foreground mb-3">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm font-arabic">
            تعذّر عرض هذه الشاشة. يمكنك المحاولة مرة أخرى أو العودة للصفحة الرئيسية.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined, componentStack: undefined })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-arabic"
            >
              إعادة المحاولة
            </button>
            <button
              onClick={() => { window.location.href = '/'; }}
              className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-arabic"
            >
              العودة للرئيسية
            </button>
          </div>
          {(this.state.error || this.state.componentStack) && (
            <pre className="mt-4 text-[10px] text-muted-foreground max-w-sm max-h-48 overflow-auto text-left" dir="ltr">
              {this.state.error?.message}
              {this.state.componentStack}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
