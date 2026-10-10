import React from 'react';
import { TreePine } from 'lucide-react';

export const Spinner = ({ size = 'md', label = 'Loading forest data...' }) => {
  const sizeClasses = {
    sm: 'w-5 h-5 border-2',
    md: 'w-8 h-8 border-3',
    lg: 'w-12 h-12 border-4'
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 space-y-3">
      <div className="relative">
        <div className={`${sizeClasses[size] || sizeClasses.md} rounded-full border-emerald-500/20 border-t-emerald-500 animate-spin`} />
        <TreePine className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400 w-4 h-4 opacity-75" />
      </div>
      {label && <p className="text-sm font-medium text-slate-400 tracking-wide animate-pulse">{label}</p>}
    </div>
  );
};

export default Spinner;
