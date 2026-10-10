import React from 'react';
import { TreePine } from 'lucide-react';

export const Footer = () => {
  return (
    <footer className="w-full border-t border-slate-900 bg-slate-950/90 text-slate-400 py-8 px-4 mt-auto">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <TreePine className="w-4 h-4 text-emerald-500" />
          <span className="font-semibold text-slate-200">
            Intelligent Forest Monitoring and Conservation System
          </span>
        </div>

        <p className="text-slate-400 text-center md:text-right">
          © {new Date().getFullYear()} Forest Conservation System. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
