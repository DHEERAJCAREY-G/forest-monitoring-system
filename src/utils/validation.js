/**
 * Form validation and security helper utilities for Forest Monitoring System
 */

// Email RFC 5322 standard regex check
export const validateEmail = (email) => {
  if (!email || !email.trim()) return 'Email address is required';
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email.trim())) {
    return 'Please enter a valid email address';
  }
  return null;
};

// Password strength evaluator & rules validator
export const evaluatePasswordStrength = (password) => {
  if (!password) {
    return { score: 0, label: 'Weak', color: 'bg-slate-700', checks: { length: false, uppercase: false, lowercase: false, number: false, special: false } };
  }

  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  const passedCount = Object.values(checks).filter(Boolean).length;

  if (passedCount <= 2) {
    return { score: 25, label: 'Weak', color: 'bg-red-500', checks };
  } else if (passedCount === 3 || passedCount === 4) {
    return { score: 65, label: 'Moderate', color: 'bg-amber-500', checks };
  } else {
    return { score: 100, label: 'Strong', color: 'bg-emerald-500', checks };
  }
};

export const validatePassword = (password) => {
  if (!password) return 'Password is required';
  if (password.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Z]/.test(password)) return 'Password must contain at least one uppercase letter (A-Z)';
  if (!/[a-z]/.test(password)) return 'Password must contain at least one lowercase letter (a-z)';
  if (!/[0-9]/.test(password)) return 'Password must contain at least one number (0-9)';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return 'Password must contain at least one special character (!@#$%^&*)';
  return null;
};

export const validateSignupForm = (formData) => {
  const errors = {};

  if (!formData.fullName || !formData.fullName.trim()) {
    errors.fullName = 'Full Name is required';
  } else if (formData.fullName.trim().length < 2) {
    errors.fullName = 'Full Name must be at least 2 characters long';
  }

  const emailError = validateEmail(formData.email);
  if (emailError) errors.email = emailError;

  const passwordError = validatePassword(formData.password);
  if (passwordError) errors.password = passwordError;

  if (!formData.confirmPassword) {
    errors.confirmPassword = 'Confirm Password is required';
  } else if (formData.password !== formData.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};

export const validateLoginForm = (formData) => {
  const errors = {};
  
  const emailError = validateEmail(formData.email);
  if (emailError) errors.email = emailError;

  if (!formData.password) {
    errors.password = 'Password is required';
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors,
  };
};
