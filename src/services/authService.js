import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut, 
  sendPasswordResetEmail, 
  sendEmailVerification,
  updateProfile 
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

/**
 * Signup: Create Firebase Auth user, update display name, save Firestore user document,
 * and send built-in Firebase email verification link.
 */
export const registerUser = async (formData) => {
  const { fullName, email, password } = formData;
  if (!email || !email.trim()) {
    return { success: false, error: 'Email address is required.' };
  }
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Step 1: Create user in Firebase Auth
    const userCredential = await createUserWithEmailAndPassword(auth, normalizedEmail, password);
    const user = userCredential.user;

    // Step 2: Update display name in Firebase Auth
    try {
      if (fullName) {
        await updateProfile(user, { displayName: fullName });
      }
    } catch (e) {
      console.warn('[Auth Service] Update profile warning:', e.message);
    }

    // Step 3: Store user document in Firestore `users` collection using Firebase UID
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        uid: user.uid,
        fullName: fullName || '',
        email: normalizedEmail,
        emailVerified: false,
        createdAt: serverTimestamp(),
        lastLoginAt: null
      });
    } catch (firestoreError) {
      console.warn('[Auth Service] Firestore document creation warning:', firestoreError.message);
    }

    // Step 4: Send Firebase built-in verification email
    try {
      await sendEmailVerification(user);
    } catch (emailErr) {
      console.warn('[Auth Service] Verification email send warning:', emailErr.message);
    }

    return {
      success: true,
      user,
      email: normalizedEmail
    };
  } catch (error) {
    console.error('[Auth Service] Signup error:', error.code, error.message);
    
    let friendlyError = 'Registration failed. Please try again.';
    if (error.code === 'auth/email-already-in-use') {
      friendlyError = 'An account with this email address already exists. Please login instead.';
    } else if (error.code === 'auth/weak-password') {
      friendlyError = 'Password is too weak. Please use at least 8 characters with numbers and symbols.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyError = 'Please enter a valid email address.';
    } else if (error.code === 'auth/network-request-failed') {
      friendlyError = 'Network request failed. Please check your internet connection.';
    } else if (error.code === 'auth/operation-not-allowed') {
      friendlyError = 'Email/Password sign-in is not enabled in Firebase Console. Please enable Email/Password under Authentication > Sign-in method.';
    } else if (error.message) {
      friendlyError = error.message;
    }

    return {
      success: false,
      error: friendlyError
    };
  }
};

/**
 * Login existing user with Email & Password.
 * Enforces email verification status before granting access.
 */
export const loginUser = async (email, password) => {
  if (!email || !email.trim()) {
    return { success: false, error: 'Email address is required.' };
  }
  if (!password) {
    return { success: false, error: 'Password is required.' };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
    const user = userCredential.user;

    // Reload user instance from Firebase server to get fresh emailVerified state
    try {
      await user.reload();
    } catch (e) {
      console.warn('[Auth Service] User reload warning:', e.message);
    }

    // Check if user's email has been verified
    if (!user.emailVerified) {
      return {
        success: false,
        unverified: true,
        user,
        error: 'Your email address is not verified yet. Please check your inbox and click the verification link.'
      };
    }

    // Fetch user profile from Firestore
    let userProfile = null;
    try {
      const docRef = doc(db, 'users', user.uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        userProfile = docSnap.data();
        await setDoc(docRef, { 
          lastLoginAt: serverTimestamp(),
          emailVerified: true
        }, { merge: true });
      }
    } catch (e) {
      console.warn('[Auth Service] Firestore profile sync warning:', e.message);
    }

    return {
      success: true,
      user,
      profile: userProfile
    };
  } catch (error) {
    console.error('[Auth Service] Login error:', error.code, error.message);
    let friendlyError = 'Authentication failed. Please check your credentials.';
    
    if (
      error.code === 'auth/user-not-found' || 
      error.code === 'auth/wrong-password' || 
      error.code === 'auth/invalid-credential'
    ) {
      friendlyError = 'Invalid email address or password. Please verify your credentials.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyError = 'Please enter a valid email address.';
    } else if (error.code === 'auth/too-many-requests') {
      friendlyError = 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later or reset your password.';
    } else if (error.code === 'auth/user-disabled') {
      friendlyError = 'This user account has been disabled.';
    } else if (error.code === 'auth/network-request-failed') {
      friendlyError = 'Network request failed. Please check your internet connection.';
    } else if (error.message) {
      friendlyError = error.message;
    }

    return {
      success: false,
      error: friendlyError
    };
  }
};

/**
 * Resend Firebase built-in email verification link
 */
export const resendVerificationEmail = async (targetUser) => {
  const user = targetUser || auth.currentUser;
  if (!user) {
    return {
      success: false,
      error: 'No active user session found. Please try logging in again.'
    };
  }

  try {
    await sendEmailVerification(user);
    return {
      success: true,
      message: `A new verification email has been sent to ${user.email}. Please check your inbox and spam folder.`
    };
  } catch (error) {
    console.error('[Auth Service] Resend verification error:', error.code, error.message);
    let friendlyError = 'Failed to send verification email. Please try again in a few moments.';
    if (error.code === 'auth/too-many-requests') {
      friendlyError = 'Too many requests. Please wait a minute before requesting another verification email.';
    } else if (error.message) {
      friendlyError = error.message;
    }
    return {
      success: false,
      error: friendlyError
    };
  }
};

/**
 * Send password reset email
 */
export const sendPasswordReset = async (email) => {
  if (!email || !email.trim()) {
    return {
      success: false,
      error: 'Please enter a valid email address.'
    };
  }

  const cleanEmail = email.trim().toLowerCase();

  try {
    await sendPasswordResetEmail(auth, cleanEmail);
    return {
      success: true,
      message: `Password reset instructions have been sent to ${cleanEmail}. Please check your inbox and spam folder.`
    };
  } catch (error) {
    console.error('[Auth Service] Password reset error:', error.code, error.message);
    let friendlyError = 'Failed to send password reset email. Please try again.';
    
    if (error.code === 'auth/user-not-found') {
      friendlyError = 'No registered user account found with this email address. Please check your spelling or sign up.';
    } else if (error.code === 'auth/invalid-email') {
      friendlyError = 'Please enter a valid email address format.';
    } else if (error.code === 'auth/missing-email') {
      friendlyError = 'Please enter your email address.';
    } else if (error.code === 'auth/too-many-requests') {
      friendlyError = 'Access to password reset has been temporarily disabled due to too many requests. Please wait a few minutes before trying again.';
    } else if (error.code === 'auth/network-request-failed') {
      friendlyError = 'Network request failed. Please check your internet connection and try again.';
    } else if (error.code === 'auth/unauthorized-domain') {
      friendlyError = 'This domain is not authorized in your Firebase Console. Please add your domain (e.g. localhost) in Firebase Console under Authentication > Settings > Authorized domains.';
    } else if (error.code === 'auth/operation-not-allowed') {
      friendlyError = 'Password reset is not enabled in your Firebase Console. Please enable Email/Password under Authentication > Sign-in method.';
    } else if (error.message) {
      friendlyError = error.message;
    }

    return {
      success: false,
      error: friendlyError
    };
  }
};

/**
 * Logout authenticated user
 */
export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
  } catch (error) {
    console.error('[Auth Service] Logout error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Update authenticated user's display name / username in both Firebase Auth and Firestore.
 * Preserves user UID, email address, password, saved locations, historical analyses, and alerts.
 */
export const updateUserDisplayName = async (newDisplayName) => {
  if (!auth.currentUser) {
    return { success: false, error: 'No active authenticated session found. Please log in.' };
  }

  const trimmed = (newDisplayName || '').trim();
  if (!trimmed) {
    return { success: false, error: 'Username cannot be empty.' };
  }
  if (trimmed.length < 2) {
    return { success: false, error: 'Username must be at least 2 characters long.' };
  }
  if (trimmed.length > 50) {
    return { success: false, error: 'Username must not exceed 50 characters.' };
  }
  // Validate characters (letters, numbers, spaces, underscores, hyphens, dots)
  const usernameRegex = /^[a-zA-Z0-9\s._-]+$/;
  if (!usernameRegex.test(trimmed)) {
    return { success: false, error: 'Username can only contain letters, numbers, spaces, dots, hyphens, and underscores.' };
  }

  const user = auth.currentUser;

  try {
    // 1. Update Firebase Authentication profile
    await updateProfile(user, { displayName: trimmed });

    // 2. Synchronize Firestore users document
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        fullName: trimmed,
        updatedAt: serverTimestamp()
      }, { merge: true });
    } catch (firestoreError) {
      console.warn('[Auth Service] Firestore profile sync warning:', firestoreError.message);
    }

    // 3. Reload user to ensure auth state has fresh token/profile
    await user.reload();

    return {
      success: true,
      displayName: trimmed,
      message: 'Username updated successfully!'
    };
  } catch (error) {
    console.error('[Auth Service] Update display name error:', error);
    return {
      success: false,
      error: error.message || 'Failed to update username. Please try again.'
    };
  }
};
