import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, TreePine, LogIn, RefreshCw, MailCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateLoginForm } from '../utils/validation';
import Alert from '../components/common/Alert';

export const LoginPage = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');
  const [serverSuccess, setServerSuccess] = useState('');
  
  const [unverifiedUser, setUnverifiedUser] = useState(null);
  const [isResending, setIsResending] = useState(false);

  const { login, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/dashboard';

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (serverError) setServerError('');
    if (serverSuccess) setServerSuccess('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setServerSuccess('');
    setUnverifiedUser(null);

    const validation = validateLoginForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await login(formData.email, formData.password);
      if (result.success) {
        navigate(from, { replace: true });
      } else if (result.unverified) {
        setUnverifiedUser(result.user);
        setServerError(result.error);
      } else {
        setServerError(result.error);
      }
    } catch (err) {
      setServerError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    if (!unverifiedUser) return;
    setIsResending(true);
    setServerError('');
    setServerSuccess('');

    try {
      const result = await resendVerification(unverifiedUser);
      if (result.success) {
        setServerSuccess(result.message || 'Verification email sent. Please check your inbox.');
      } else {
        setServerError(result.error);
      }
    } catch (err) {
      setServerError('Failed to resend verification email.');
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mb-2">
            <TreePine className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Account Login</h1>
          <p className="text-sm text-slate-400">
            Access the Intelligent Forest Monitoring System
          </p>
        </div>

        {/* Server Alerts */}
        {serverError && (
          <div className="space-y-3">
            <Alert 
              type="error" 
              message={serverError} 
              onClose={() => setServerError('')} 
            />
            
            {/* If user email is unverified, provide Resend Option */}
            {unverifiedUser && (
              <div className="p-4 rounded-2xl bg-amber-950/60 border border-amber-800/60 flex flex-col space-y-2 text-xs text-amber-200">
                <div className="flex items-center space-x-2 font-semibold">
                  <MailCheck className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Email Verification Required</span>
                </div>
                <p>Did not receive the verification link in your inbox?</p>
                <button
                  type="button"
                  onClick={handleResendEmail}
                  disabled={isResending}
                  className="w-full py-2 px-3 rounded-xl bg-amber-900/60 hover:bg-amber-800/80 text-white font-bold flex items-center justify-center space-x-2 transition-all border border-amber-700/50 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isResending ? 'animate-spin' : ''}`} />
                  <span>{isResending ? 'Sending Verification Link...' : 'Resend Verification Email'}</span>
                </button>
              </div>
            )}
          </div>
        )}

        {serverSuccess && (
          <Alert 
            type="success" 
            message={serverSuccess} 
            onClose={() => setServerSuccess('')} 
          />
        )}

        {/* Login Form */}
        <div className="p-8 rounded-3xl glass-panel border border-emerald-900/40 shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            
            {/* Email Field */}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Email Address
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Mail className="w-5 h-5" />
                </div>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="user@forestmonitoring.org"
                  disabled={isSubmitting}
                  className={`w-full pl-11 pr-4 py-3 bg-slate-950/80 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm ${
                    errors.email ? 'border-red-500/80 focus:ring-red-500' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {errors.email && (
                <p className="text-xs text-red-400 font-medium pt-0.5">{errors.email}</p>
              )}
            </div>

            {/* Password Field */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-emerald-400 hover:text-emerald-300 font-medium transition-colors"
                >
                  Forgot Password?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••••••"
                  disabled={isSubmitting}
                  className={`w-full pl-11 pr-11 py-3 bg-slate-950/80 border rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all text-sm ${
                    errors.password ? 'border-red-500/80 focus:ring-red-500' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-xs text-red-400 font-medium pt-0.5">{errors.password}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 border border-emerald-400/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </div>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Log In to Dashboard</span>
                </>
              )}
            </button>
          </form>

          {/* Footer Link */}
          <div className="pt-2 text-center text-xs text-slate-400">
            Don't have an account?{' '}
            <Link to="/signup" className="text-emerald-400 font-semibold hover:underline">
              Create Account
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;
