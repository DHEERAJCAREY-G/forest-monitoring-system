import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, KeyRound, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateEmail } from '../utils/validation';
import Alert from '../components/common/Alert';

export const ForgotPasswordPage = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { resetPassword } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    const emailError = validateEmail(email);
    if (emailError) {
      setError(emailError);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await resetPassword(email);
      if (result.success) {
        setSuccess(result.message);
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to process password reset request. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mb-2 shadow-lg shadow-emerald-950/50">
            <KeyRound className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Reset Password</h1>
          <p className="text-sm text-slate-400">
            Enter your registered email address to receive password reset instructions
          </p>
        </div>

        {error && <Alert type="error" message={error} onClose={() => setError('')} />}

        {success ? (
          <div className="p-8 rounded-3xl glass-panel border border-emerald-900/40 shadow-2xl space-y-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-950 border border-emerald-500/40 text-emerald-400 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-white">Reset Email Dispatched</h3>
              <p className="text-sm text-slate-300 leading-relaxed">{success}</p>
            </div>
            <Link
              to="/login"
              className="inline-flex items-center space-x-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-colors pt-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Return to Login</span>
            </Link>
          </div>
        ) : (
          <div className="p-8 rounded-3xl glass-panel border border-emerald-900/40 shadow-2xl space-y-6">
            <form onSubmit={handleSubmit} className="space-y-5" noValidate>
              
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Registered Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (error) setError('');
                    }}
                    placeholder="user@forestmonitoring.org"
                    disabled={isSubmitting}
                    className="w-full pl-11 pr-4 py-3 bg-slate-950/80 border border-slate-800 focus:border-emerald-500 rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 border border-emerald-400/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <div className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    <span>Sending Reset Link...</span>
                  </div>
                ) : (
                  <span>Send Reset Password Link</span>
                )}
              </button>
            </form>

            <div className="pt-2 text-center text-xs">
              <Link to="/login" className="text-slate-400 hover:text-white flex items-center justify-center space-x-1 transition-colors">
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back to Login</span>
              </Link>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};

export default ForgotPasswordPage;
