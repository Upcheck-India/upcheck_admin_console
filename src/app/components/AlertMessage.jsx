import { AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

export function AlertMessage({ type, message, onClose }) {
  const styles = {
    success: 'bg-green-50 text-green-800 border-green-200',
    error: 'bg-red-50 text-red-800 border-red-200',
    warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
    loading: 'bg-blue-50 text-blue-800 border-blue-200'
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5" />,
    error: <XCircle className="w-5 h-5" />,
    warning: <AlertCircle className="w-5 h-5" />,
    loading: <Loader2 className="w-5 h-5 animate-spin" />
  };

  return (
    <div className="fixed top-0 right-0 left-0 md:top-4 md:right-4 md:left-auto m-4 md:m-0 animate-slideIn">
      <div className={`p-4 rounded-lg border shadow-lg flex items-center gap-2 ${styles[type]}`}>
        {icons[type]}
        <p className="text-sm md:text-base">{message}</p>
        {type !== 'loading' && (
          <button
            onClick={onClose}
            className="ml-auto hover:bg-opacity-20 hover:bg-gray-900 rounded-full w-6 h-6 flex items-center justify-center transition-colors duration-200"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}