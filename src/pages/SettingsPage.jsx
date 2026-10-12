import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  User, 
  CheckCircle2, 
  AlertCircle, 
  Save, 
  X, 
  ArrowLeft, 
  ShieldCheck, 
  Mail, 
  Fingerprint, 
  Clock, 
  Loader2 
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { currentUser, userProfile, updateUsername } = useAuth();
  const navigate = useNavigate();

  const currentDisplayName = userProfile?.fullName || currentUser?.displayName || currentUser?.email?.split('@')[0] || '';

  const [username, setUsername] = useState(currentDisplayName);
  const [initialUsername, setInitialUsername] = useState(currentDisplayName);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [validationError, setValidationError] = useState('');
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (currentDisplayName) {
      setUsername(currentDisplayName);
      setInitialUsername(currentDisplayName);
    }
  }, [currentDisplayName]);

  const validateInput = (value) => {
    const trimmed = value.trim();
    if (!trimmed) {
      return 'Username cannot be empty.';
    }
    if (trimmed.length < 2) {
      return 'Username must be at least 2 characters long.';
    }
    if (trimmed.length > 50) {
      return 'Username must not exceed 50 characters.';
    }
    const validPattern = /^[a-zA-Z0-9\s._-]+$/;
    if (!validPattern.test(trimmed)) {
      return 'Username can only contain letters, numbers, spaces, dots, hyphens, and underscores.';
    }
    return '';
  };

  const handleUsernameChange = (e) => {
    const val = e.target.value;
    setUsername(val);
    setValidationError(validateInput(val));
    if (feedback.message) setFeedback({ type: '', message: '' });
  };

  const handleCancel = () => {
    setUsername(initialUsername);
    setValidationError('');
    setFeedback({ type: '', message: '' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const err = validateInput(username);
    if (err) {
      setValidationError(err);
      return;
    }

    if (username.trim() === initialUsername.trim()) {
      setFeedback({
        type: 'info',
        message: 'No changes detected. Username is already set to this value.'
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback({ type: '', message: '' });

    try {
      const res = await updateUsername(username.trim());
      if (res.success) {
        setInitialUsername(username.trim());
        setFeedback({
          type: 'success',
          message: 'Username updated successfully! Your new identity is now active across the system.'
        });
      } else {
        setFeedback({
          type: 'error',
          message: res.error || 'Failed to update username. Please try again.'
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'An unexpected error occurred while saving your profile.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel();
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-8 animate-fadeIn">
      
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          to="/dashboard"
          className="inline-flex items-center space-x-2 text-xs font-semibold px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-emerald-400 hover:border-emerald-800/60 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        <span className="text-xs font-mono text-slate-400">
          Account Settings
        </span>
      </div>

      {/* Main Settings Card */}
      <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-slate-800 space-y-8 shadow-2xl">
        
        {/* Title & Introduction */}
        <div className="border-b border-slate-800/80 pb-6 flex items-start justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center space-x-3">
              <User className="w-7 h-7 text-emerald-400" />
              <span>User Profile & Settings</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-2xl">
              Manage your display name and view account configuration. Your display name is used across monitoring reports, satellite observations, and alert dispatches.
            </p>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-emerald-950/70 border border-emerald-800/60 text-emerald-300 text-xs font-semibold shrink-0">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Profile Synced</span>
          </div>
        </div>

        {/* Feedback Banners */}
        {feedback.message && (
          <div
            role="alert"
            className={`p-4 rounded-2xl border text-xs sm:text-sm flex items-start space-x-3 ${
              feedback.type === 'success'
                ? 'bg-emerald-950/60 border-emerald-800/80 text-emerald-200'
                : feedback.type === 'error'
                ? 'bg-red-950/60 border-red-800/80 text-red-200'
                : 'bg-cyan-950/60 border-cyan-800/80 text-cyan-200'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            ) : feedback.type === 'error' ? (
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-semibold">
                {feedback.type === 'success' ? 'Profile Updated' : feedback.type === 'error' ? 'Update Error' : 'Information'}
              </p>
              <p className="text-xs leading-relaxed opacity-90">{feedback.message}</p>
            </div>
          </div>
        )}

        {/* Username Edit Form */}
        <form onSubmit={handleSubmit} onKeyDown={handleKeyDown} className="space-y-6">
          
          <div className="space-y-2">
            <label 
              htmlFor="username" 
              className="block text-xs font-semibold text-slate-300 uppercase tracking-wider"
            >
              Username / Display Name <span className="text-emerald-400">*</span>
            </label>
            
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              
              <input
                id="username"
                type="text"
                value={username}
                onChange={handleUsernameChange}
                disabled={isSubmitting}
                maxLength={50}
                placeholder="Enter your full name or callsign..."
                aria-invalid={!!validationError}
                aria-describedby={validationError ? "username-error" : "username-helper"}
                className={`w-full pl-10 pr-4 py-3 bg-slate-950 border rounded-2xl text-sm font-medium text-white placeholder-slate-500 focus:outline-none transition-all ${
                  validationError 
                    ? 'border-red-500 focus:ring-2 focus:ring-red-500/30' 
                    : 'border-slate-800 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
                }`}
              />
            </div>

            {/* Validation Message */}
            {validationError ? (
              <p id="username-error" className="text-xs text-red-400 flex items-center space-x-1.5 pt-1">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{validationError}</span>
              </p>
            ) : (
              <p id="username-helper" className="text-[11px] text-slate-500 flex justify-between pt-1">
                <span>Allowed: 2–50 characters (letters, numbers, spaces, dots, hyphens, underscores).</span>
                <span className="font-mono">{username.length}/50</span>
              </p>
            )}
          </div>

          {/* Form Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={isSubmitting || !!validationError || username.trim() === initialUsername.trim()}
              className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-emerald-950/40 flex items-center justify-center space-x-2 border border-emerald-400/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting || username === initialUsername}
              className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-semibold text-xs sm:text-sm border border-slate-800 transition-colors flex items-center justify-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <X className="w-4 h-4" />
              <span>Cancel</span>
            </button>
          </div>
        </form>

        {/* Read-Only Account Security & Identity Details */}
        <div className="pt-6 border-t border-slate-800/80 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Preserved Account Credentials & Identifiers
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Registered Email */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-semibold text-slate-500 flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-cyan-400" />
                <span>Primary Account Email</span>
              </span>
              <p className="text-sm font-semibold text-slate-200 font-mono">
                {currentUser?.email}
              </p>
              <p className="text-[10px] text-slate-500">
                Email address and passwords remain unchanged and secure.
              </p>
            </div>

            {/* Firebase UID */}
            <div className="p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-1.5">
              <span className="text-[10px] uppercase font-semibold text-slate-500 flex items-center space-x-1.5">
                <Fingerprint className="w-3.5 h-3.5 text-emerald-400" />
                <span>Firebase User ID (UID)</span>
              </span>
              <p className="text-xs font-mono text-emerald-300 truncate">
                {currentUser?.uid}
              </p>
              <p className="text-[10px] text-slate-500">
                All saved forest locations and telemetry remain tied to this UID.
              </p>
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default SettingsPage;
