import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { supabase } from '../lib/supabase';
import Logo from '../components/Logo';
import '../styles/animations.css';

interface LocationState {
  message?: string;
  error?: string;
}

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isResetPassword, setIsResetPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user } = useAuth();

  useEffect(() => {
    // Handle location state messages
    const state = location.state as LocationState;
    if (state?.message) {
      setSuccessMessage(state.message);
      setError('');
    } else if (state?.error) {
      setError(state.error);
      setSuccessMessage('');
    }
    // Clear location state
    window.history.replaceState({}, document.title);
  }, [location]);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccessMessage('');
      setLoading(true);

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      setSuccessMessage('Password reset instructions have been sent to your email.');
      setIsResetPassword(false);
    } catch (err) {
      console.error('Password reset error:', err);
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to send reset instructions. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setError('');
      setSuccessMessage('');
      setLoading(true);
      if (isSignUp) {
        await signUp(email, password, fullName, phone);
        setSuccessMessage('Please check your email to verify your account. Once verified, you can sign in.');
      } else {
        await signIn(email, password);
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Authentication error:', err);
      setError(
        err instanceof Error 
          ? err.message 
          : isSignUp 
            ? 'Failed to sign up. Please try again.' 
            : 'Failed to sign in. Please check your credentials.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-blue-900 relative overflow-hidden">
      {/* Tech-inspired background patterns */}
      <div className="absolute inset-0 z-0 opacity-30">
        <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, rgba(255,255,255,0.15) 1px, transparent 0)', backgroundSize: '40px 40px' }}></div>
        <div className="absolute h-screen w-screen bg-[linear-gradient(to_right,rgba(55,65,81,0)_1px,transparent_1px),linear-gradient(to_bottom,rgba(55,65,81,0)_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_110%)]"></div>
      </div>

      {/* Animated gradients */}
      <div className="absolute inset-0 z-0">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-gradient-to-r from-blue-500/30 to-cyan-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob"></div>
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-gradient-to-r from-purple-500/30 to-pink-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-gradient-to-r from-indigo-500/30 to-blue-500/30 rounded-full mix-blend-screen filter blur-3xl opacity-50 animate-pulse"></div>
      </div>

      {/* Tech circuit lines */}
      <div className="absolute inset-0 z-0 opacity-20">
        <svg className="absolute w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <path d="M0,0 L100,0 L100,100 L0,100 Z" fill="none" stroke="url(#grid-gradient)" strokeWidth="0.1" />
          <defs>
            <linearGradient id="grid-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#93c5fd" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#1d4ed8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <div className="w-full min-h-screen flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="w-full max-w-md mx-auto">
          <div className="flex flex-col items-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur-lg opacity-30 animate-pulse"></div>
              <div className="relative bg-black/30 backdrop-blur-xl rounded-2xl p-6 ring-1 ring-white/10">
                <Logo size="large" />
              </div>
            </div>
            <h2 className="mt-8 text-center text-3xl font-bold tracking-tight text-white">
              {isResetPassword ? 'Reset Password' : isSignUp ? 'Create your Account' : 'Welcome Back'}
            </h2>
            <p className="mt-4 text-center text-lg text-gray-300 max-w-sm">
              {isResetPassword 
                ? "Enter your email and we'll send you instructions to reset your password."
                : 'Experience the future of customer support with our AI-powered ticketing system.'}
            </p>
          </div>
        </div>

        <div className="mt-10 w-full max-w-md mx-auto">
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-2xl blur opacity-20"></div>
            <div className="relative bg-black/30 backdrop-blur-xl py-8 px-4 shadow-2xl ring-1 ring-white/10 sm:rounded-xl sm:px-10">
              <form className="space-y-6" onSubmit={isResetPassword ? handlePasswordReset : handleSubmit}>
                {error && (
                  <div className="rounded-lg bg-red-500/10 p-4 backdrop-blur-sm ring-1 ring-red-500/50">
                    <div className="text-sm text-red-200">{error}</div>
                  </div>
                )}
                {successMessage && (
                  <div className="rounded-lg bg-green-500/10 p-4 backdrop-blur-sm ring-1 ring-green-500/50">
                    <div className="text-sm text-green-200">{successMessage}</div>
                  </div>
                )}
                
                {!isResetPassword && isSignUp && (
                  <>
                    <div className="space-y-1">
                      <label htmlFor="full-name" className="block text-sm font-medium text-gray-200">
                        Full Name
                      </label>
                      <div className="mt-1">
                        <input
                          id="full-name"
                          name="full-name"
                          type="text"
                          required
                          className="block w-full appearance-none rounded-lg border border-white/5 bg-black/20 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm backdrop-blur-xl transition-colors text-white"
                          placeholder="Enter your full name"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label htmlFor="phone" className="block text-sm font-medium text-gray-200">
                        Phone Number
                      </label>
                      <div className="mt-1">
                        <input
                          id="phone"
                          name="phone"
                          type="tel"
                          className="block w-full appearance-none rounded-lg border border-white/5 bg-black/20 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm backdrop-blur-xl transition-colors text-white"
                          placeholder="Enter your phone number"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-1">
                  <label htmlFor="email-address" className="block text-sm font-medium text-gray-200">
                    Email address
                  </label>
                  <div className="mt-1">
                    <input
                      id="email-address"
                      name="email"
                      type="email"
                      autoComplete="email"
                      required
                      className="block w-full appearance-none rounded-lg border border-white/5 bg-black/20 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm backdrop-blur-xl transition-colors text-white"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>

                {!isResetPassword && (
                  <div className="space-y-1">
                    <label htmlFor="password" className="block text-sm font-medium text-gray-200">
                      Password
                    </label>
                    <div className="mt-1">
                      <input
                        id="password"
                        name="password"
                        type="password"
                        autoComplete={isSignUp ? 'new-password' : 'current-password'}
                        required
                        className="block w-full appearance-none rounded-lg border border-white/5 bg-black/20 px-3 py-2 shadow-sm placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-blue-500 sm:text-sm backdrop-blur-xl transition-colors text-white"
                        placeholder={isSignUp ? 'Create a password' : 'Enter your password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                      />
                    </div>
                  </div>
                )}

                <div>
                  <button
                    type="submit"
                    disabled={loading}
                    className="relative w-full group"
                  >
                    <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-lg blur opacity-60 group-hover:opacity-100 transition duration-200"></div>
                    <div className="relative flex w-full justify-center rounded-lg border border-transparent bg-black py-2.5 px-4 text-sm font-semibold text-white shadow-sm hover:bg-black/80 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200">
                      {loading ? (
                        <div className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          {isResetPassword ? 'Sending instructions...' : isSignUp ? 'Creating account...' : 'Signing in...'}
                        </div>
                      ) : (
                        isResetPassword ? 'Send Reset Instructions' : isSignUp ? 'Create Account' : 'Sign in'
                      )}
                    </div>
                  </button>
                </div>
              </form>

              <div className="mt-6">
                <div className="relative">
                  <div className="relative flex flex-col items-center gap-4 text-sm">
                    {!isResetPassword && (
                      <button
                        type="button"
                        className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                        onClick={() => {
                          setIsSignUp(!isSignUp);
                          setError('');
                        }}
                      >
                        {isSignUp ? 'Already have an account? Sign in' : "Create a new account"}
                      </button>
                    )}
                    <button
                      type="button"
                      className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
                      onClick={() => {
                        setIsResetPassword(!isResetPassword);
                        setError('');
                        setSuccessMessage('');
                      }}
                    >
                      {isResetPassword ? 'Back to sign in' : 'Forgot your password?'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 