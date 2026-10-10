import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { MailCheck, RefreshCw, ArrowLeft, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Alert from '../components/common/Alert';

export const VerifyEmailPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, resendVerification, reloadUser } = useAuth();

  const targetEmail = location.state?.email || currentUser?.email || 'your email address';

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Cooldown countdown effect
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  // If user becomes verified, redirect to dashboard automatically
  useEffect(() => {
    if (currentUser?.emailVerified) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentUser, navigate]);

  const handleResendEmail = async () => {
    setError('');
    setMessage('');
    setIsSending(true);

    try {
      const result = await resendVerification(currentUser);
      if (result.success) {
        setMessage(result.message || `Verification email successfully sent to ${targetEmail}`);
        setResendCooldown(30); // 30-second cooldown
      } else {
        setError(result.error);
      }
    } catch (err) {
      setError('Failed to resend verification email. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleCheckStatus = async () => {
    setError('');
    setMessage('');
    setIsChecking(true);

    try {
      const updatedUser = await reloadUser();
      if (updatedUser?.emailVerified) {
        setMessage('Email verified! Redirecting to command dashboard...');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 1000);
      } else {
        setError('Your email is not verified yet. Please check your inbox and click the verification link.');
      }
    } catch (err) {
      setError('Failed to check verification status. Please try again.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mb-2 shadow-lg shadow-emerald-950/50">
            <MailCheck className="w-8 h-8 animate-pulse" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Verify Your Email</h1>
          <p className="text-sm text-slate-400">
            A Firebase verification link has been sent to <br />
            <span className="text-emerald-300 font-mono font-semibold">{targetEmail}</span>
          </p>
        </div>

        {/* Alerts */}
        {error && <Alert type="error" message={error} onClose={() => setError('')} />}
        {message && <Alert type="success" message={message} onClose={() => setMessage('')} />}

        {/* Main Card */}
        <div className="p-8 rounded-3xl glass-panel border border-emerald-900/40 shadow-2xl space-y-6">
          
          <div className="space-y-3 text-xs text-slate-300 leading-relaxed bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
            <p className="flex items-start space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <span>Click the verification link in the email sent by Firebase Authentication to confirm your officer identity.</span>
            </p>
            <p className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>If you don't see the email in your inbox within a few minutes, check your <strong>Spam or Junk folder</strong>.</span>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3 pt-2">
            
            {/* Check Verification Status Button */}
            <button
              onClick={handleCheckStatus}
              disabled={isChecking}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 border border-emerald-400/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
            >
              {isChecking ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Checking Verification Status...</span>
                </div>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>I've Verified My Email</span>
                </>
              )}
            </button>

            {/* Resend Email Button */}
            <button
              onClick={handleResendEmail}
              disabled={isSending || resendCooldown > 0}
              className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 font-semibold text-xs border border-slate-700/80 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${resendCooldown > 0 ? 'animate-spin' : ''}`} />
              <span>
                {resendCooldown > 0 
                  ? `Resend Verification Email in ${resendCooldown}s` 
                  : 'Resend Verification Email'}
              </span>
            </button>
          </div>

          <div className="pt-2 text-center text-xs">
            <Link
              to="/login"
              className="text-slate-400 hover:text-white flex items-center justify-center space-x-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Return to Officer Login</span>
            </Link>
          </div>

        </div>

      </div>
    </div>
  );
};

export default VerifyEmailPage;
