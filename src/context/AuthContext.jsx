import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { 
  registerUser, 
  loginUser, 
  logoutUser, 
  sendPasswordReset,
  resendVerificationEmail 
} from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Synchronize user profile document from Firestore `users` collection
  const fetchUserProfile = async (uid) => {
    if (!uid) return null;
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile(data);
        return data;
      }
    } catch (e) {
      console.warn('[AuthContext] Firestore profile fetch error:', e.message);
    }
    return null;
  };

  // Reload current user state from Firebase server
  const reloadUser = async () => {
    if (auth.currentUser) {
      try {
        await auth.currentUser.reload();
        setCurrentUser({ ...auth.currentUser });
        if (auth.currentUser.uid) {
          await fetchUserProfile(auth.currentUser.uid);
        }
        return auth.currentUser;
      } catch (e) {
        console.warn('[AuthContext] Reload user error:', e.message);
      }
    }
    return null;
  };

  // Firebase Auth State Listener for persistence across browser reloads
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        await fetchUserProfile(user.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signup = async (formData) => {
    setAuthError(null);
    return await registerUser(formData);
  };

  const login = async (email, password) => {
    setAuthError(null);
    const result = await loginUser(email, password);
    if (result.success) {
      setCurrentUser(result.user);
      setUserProfile(result.profile);
    } else {
      setAuthError(result.error);
    }
    return result;
  };

  const resendVerification = async (targetUser) => {
    setAuthError(null);
    return await resendVerificationEmail(targetUser || currentUser);
  };

  const logout = async () => {
    setAuthError(null);
    const result = await logoutUser();
    setCurrentUser(null);
    setUserProfile(null);
    return result;
  };

  const resetPassword = async (email) => {
    setAuthError(null);
    return await sendPasswordReset(email);
  };

  const value = {
    currentUser,
    userProfile,
    loading,
    authError,
    setAuthError,
    signup,
    login,
    logout,
    resetPassword,
    resendVerification,
    reloadUser,
    isAuthenticated: !!(currentUser && currentUser.emailVerified)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
