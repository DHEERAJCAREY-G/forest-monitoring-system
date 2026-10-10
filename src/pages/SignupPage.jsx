import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, User, Eye, EyeOff, TreePine, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { validateSignupForm, evaluatePasswordStrength } from '../utils/validation';
import Alert from '../components/common/Alert';

export const SignupPage = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  const { signup } = useAuth();
  const navigate = useNavigate();

  const passwordStrength = evaluatePasswordStrength(formData.password);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: null }));
    }
    if (serverError) setServerError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    const validation = validateSignupForm(formData);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signup(formData);
      if (result.success) {
        navigate('/verify-email', { 
          state: { 
            email: formData.email 
          } 
        });
      } else {
        setServerError(result.error);
        setIsSubmitting(false);
      }
    } catch (err) {
      setServerError('Registration failed. Please check network connection and try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-lg space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-emerald-950/80 border border-emerald-800/60 text-emerald-400 mb-2">
            <TreePine className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Create Your Account</h1>
          <p className="text-sm text-slate-400">
            Register to monitor forest locations with the Intelligent Forest Monitoring System
          </p>
        </div>

        {serverError && (
          <Alert type="error" message={serverError} onClose={() => setServerError('')} />
        )}

        <div className="p-8 rounded-3xl glass-panel border border-emerald-900/40 shadow-2xl space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            
            {/* Full Name */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Rajesh Kumar"
                  disabled={isSubmitting}
                  className={`w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    errors.fullName ? 'border-red-500/80' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {errors.fullName && <p className="text-xs text-red-400 font-medium">{errors.fullName}</p>}
            </div>

            {/* Email */}
            <div className="space-y-1">
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
                  className={`w-full pl-11 pr-4 py-2.5 bg-slate-950/80 border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    errors.email ? 'border-red-500/80' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
              </div>
              {errors.email && <p className="text-xs text-red-400 font-medium">{errors.email}</p>}
            </div>

            {/* Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Minimum 8 characters"
                  disabled={isSubmitting}
                  className={`w-full pl-11 pr-11 py-2.5 bg-slate-950/80 border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    errors.password ? 'border-red-500/80' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Live Password Strength Meter */}
              {formData.password && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Strength:</span>
                    <span className="font-bold text-slate-200">{passwordStrength.label}</span>
                  </div>
                  <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-300 ${passwordStrength.color}`} 
                      style={{ width: `${passwordStrength.score}%` }}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-1 text-[10px] text-slate-400 pt-1">
                    <span className={passwordStrength.checks.length ? 'text-emerald-400' : ''}>• Min 8 chars</span>
                    <span className={passwordStrength.checks.uppercase ? 'text-emerald-400' : ''}>• Uppercase (A-Z)</span>
                    <span className={passwordStrength.checks.number ? 'text-emerald-400' : ''}>• Number (0-9)</span>
                    <span className={passwordStrength.checks.special ? 'text-emerald-400' : ''}>• Special (!@#$)</span>
                  </div>
                </div>
              )}
              {errors.password && <p className="text-xs text-red-400 font-medium pt-0.5">{errors.password}</p>}
            </div>

            {/* Confirm Password */}
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                Confirm Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-5 h-5" />
                </div>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Re-enter password"
                  disabled={isSubmitting}
                  className={`w-full pl-11 pr-11 py-2.5 bg-slate-950/80 border rounded-xl text-slate-100 placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all ${
                    errors.confirmPassword ? 'border-red-500/80' : 'border-slate-800 focus:border-emerald-500'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-xs text-red-400 font-medium pt-0.5">{errors.confirmPassword}</p>
              )}
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 border border-emerald-400/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isSubmitting ? (
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span>Creating Account...</span>
                </div>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account & Send Verification Email</span>
                </>
              )}
            </button>
          </form>

          <div className="pt-2 text-center text-xs text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-emerald-400 font-semibold hover:underline">
              Log In
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};

export default SignupPage;
