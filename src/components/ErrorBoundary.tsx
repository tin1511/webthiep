import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Đã xảy ra sự cố bất ngờ.',
    };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      let friendlyMsg = 'Ứng dụng vừa gặp sự cố tạm thời. Bạn vui lòng tải lại trang nhé.';
      if (this.state.errorMessage.includes('Missing or insufficient permissions')) {
        friendlyMsg =
          'Phiên làm việc hiện tại chưa đủ quyền thực hiện thao tác này. Vui lòng kiểm tra đăng nhập hoặc thử lại.';
      }
      return (
        <div className="min-h-screen bg-[#14100E] text-[#F7F1E8] flex items-center justify-center p-4">
          <div className="max-w-md w-full rounded-2xl border border-[#E6BE73]/30 bg-[#1B1512] p-6 space-y-4 text-center">
            <div className="mx-auto w-12 h-12 rounded-xl bg-[#B83B4A]/20 text-[#F09D8B] flex items-center justify-center">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-lg font-bold m-0">Có chút gián đoạn</h2>
            <p className="text-sm text-[#C8BDB2] leading-relaxed m-0">{friendlyMsg}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-5 py-2.5 rounded-xl bg-[#E6BE73] text-[#1A1208] text-sm font-semibold cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Tải lại trang</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
