import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle, X } from 'lucide-react';

export const Alert = ({ type = 'error', message, title, onClose, className = '' }) => {
  if (!message) return null;

  const styles = {
    error: {
      bg: 'bg-red-950/40 border-red-800/50 text-red-200',
      icon: <XCircle className="w-5 h-5 text-red-400 shrink-0" />,
      accent: 'border-l-4 border-l-red-500'
    },
    success: {
      bg: 'bg-emerald-950/40 border-emerald-800/50 text-emerald-200',
      icon: <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />,
      accent: 'border-l-4 border-l-emerald-500'
    },
    warning: {
      bg: 'bg-amber-950/40 border-amber-800/50 text-amber-200',
      icon: <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />,
      accent: 'border-l-4 border-l-amber-500'
    },
    info: {
      bg: 'bg-teal-950/40 border-teal-800/50 text-teal-200',
      icon: <Info className="w-5 h-5 text-teal-400 shrink-0" />,
      accent: 'border-l-4 border-l-teal-500'
    }
  };

  const current = styles[type] || styles.error;

  return (
    <div className={`p-4 rounded-xl border backdrop-blur-md ${current.bg} ${current.accent} flex items-start justify-between shadow-lg animate-fadeIn ${className}`}>
      <div className="flex items-start space-x-3">
        {current.icon}
        <div>
          {title && <h4 className="font-semibold text-sm mb-0.5">{title}</h4>}
          <p className="text-sm font-medium leading-relaxed">{message}</p>
        </div>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-slate-400 hover:text-slate-200 p-1 rounded-lg hover:bg-white/5 transition-colors"
          aria-label="Close alert"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default Alert;
