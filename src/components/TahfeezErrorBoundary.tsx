import React from 'react';
import { Link } from 'react-router-dom';

interface State {
  hasError: boolean;
  error?: Error;
}

export class TahfeezErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[TahfeezErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center" dir="rtl">
          <h2 className="text-xl font-arabic font-bold text-foreground mb-3">حدث خطأ غير متوقع</h2>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm font-arabic">
            حدث خطأ أثناء تشغيل الاختبار. يمكنك العودة والمحاولة مرة أخرى.
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-arabic"
            >
              إعادة المحاولة
            </button>
            <Link
              to="/"
              className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm font-arabic"
            >
              العودة للرئيسية
            </Link>
          </div>
          {this.state.error && (
            <pre className="mt-4 text-[10px] text-muted-foreground max-w-sm overflow-auto text-left" dir="ltr">
              {this.state.error.message}
            </pre>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
