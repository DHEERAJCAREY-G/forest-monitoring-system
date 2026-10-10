import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Spinner from '../common/Spinner';

export const ProtectedRoute = ({ children }) => {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <Spinner size="lg" label="Authenticating session..." />
      </div>
    );
  }

  // Guard 1: Must be logged in
  if (!currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Guard 2: Email must be verified via Firebase Auth
  if (!currentUser.emailVerified) {
    return <Navigate to="/verify-email" state={{ email: currentUser.email }} replace />;
  }

  return children;
};

export default ProtectedRoute;
