import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/common/Navbar';
import Footer from './components/common/Footer';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import DashboardPage from './pages/DashboardPage';
import SettingsPage from './pages/SettingsPage';

// Route Guards
import ProtectedRoute from './components/auth/ProtectedRoute';
import PublicRoute from './components/auth/PublicRoute';

export const App = () => {
  return (
    <Router>
      <AuthProvider>
        <div className="flex flex-col min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500 selection:text-white">
          <Navbar />
          
          <main className="flex-1">
            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />

              <Route 
                path="/login" 
                element={
                  <PublicRoute>
                    <LoginPage />
                  </PublicRoute>
                } 
              />

              <Route 
                path="/signup" 
                element={
                  <PublicRoute>
                    <SignupPage />
                  </PublicRoute>
                } 
              />

              <Route 
                path="/verify-email" 
                element={<VerifyEmailPage />} 
              />

              <Route 
                path="/forgot-password" 
                element={
                  <PublicRoute>
                    <ForgotPasswordPage />
                  </PublicRoute>
                } 
              />

              {/* Protected Routes */}
              <Route 
                path="/dashboard" 
                element={
                  <ProtectedRoute>
                    <DashboardPage />
                  </ProtectedRoute>
                } 
              />

              <Route 
                path="/settings" 
                element={
                  <ProtectedRoute>
                    <SettingsPage />
                  </ProtectedRoute>
                } 
              />

              {/* Catch-all fallback */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <Footer />
        </div>
      </AuthProvider>
    </Router>
  );
};

export default App;
