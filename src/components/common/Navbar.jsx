import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { TreePine, LogOut, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export const Navbar = () => {
  const { currentUser, userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 w-full glass-panel border-b border-emerald-900/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        {/* Logo & Brand */}
        <Link to="/" className="flex items-center space-x-3 group">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 p-0.5 shadow-lg shadow-emerald-950/30 group-hover:shadow-emerald-500/20 transition-all duration-300">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <TreePine className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform duration-300" />
            </div>
          </div>
          <div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-200 bg-clip-text text-transparent">
              Forest Monitoring System
            </span>
          </div>
        </Link>

        {/* Navigation Actions */}
        <nav className="flex items-center space-x-3">
          {currentUser ? (
            <div className="flex items-center space-x-3">
              <Link 
                to="/dashboard" 
                className={`flex items-center space-x-2 text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  isActive('/dashboard') 
                    ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-800/60' 
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Activity className="w-4 h-4 text-emerald-400" />
                <span className="font-medium">Dashboard</span>
              </Link>

              {/* User Identity Chip */}
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full pl-2 pr-3 py-1 text-xs">
                <div className="w-6 h-6 rounded-full bg-emerald-700/50 text-emerald-300 flex items-center justify-center font-bold">
                  {(userProfile?.fullName || currentUser.displayName || currentUser.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="hidden sm:block text-left">
                  <p className="font-semibold text-slate-200 truncate max-w-[140px]">
                    {userProfile?.fullName || currentUser.displayName || currentUser.email?.split('@')[0]}
                  </p>
                </div>
              </div>

              {/* Logout Button */}
              <button
                onClick={handleLogout}
                className="flex items-center space-x-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-red-950/40 text-red-300 hover:bg-red-900/60 border border-red-800/40 transition-colors shadow-sm"
                title="Logout"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className={`text-sm px-4 py-2 rounded-xl transition-all ${
                  isActive('/login')
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-300 hover:text-white hover:bg-slate-900/60'
                }`}
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="text-sm px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-medium hover:from-emerald-500 hover:to-teal-500 shadow-md shadow-emerald-950/50 transition-all border border-emerald-400/20"
              >
                Get Started
              </Link>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
};

export default Navbar;
