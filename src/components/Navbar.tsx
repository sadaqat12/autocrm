import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Logo from './Logo';
import { commonStyles } from '../styles/theme';

interface NavbarProps {
  title?: string;
  showRefresh?: boolean;
  onRefresh?: () => Promise<void>;
  isLoading?: boolean;
  actions?: {
    label: string;
    icon: JSX.Element;
    onClick: () => void;
  }[];
}

export default function Navbar({ 
  title,
  showRefresh = false,
  onRefresh,
  isLoading = false,
  actions = []
}: NavbarProps) {
  const navigate = useNavigate();
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      navigate('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Combine all actions including sign out
  const allActions = [
    ...actions,
    {
      label: 'Sign Out',
      icon: (
        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
      ),
      onClick: handleSignOut
    }
  ];

  if (showRefresh) {
    allActions.unshift({
      label: isLoading ? 'Refreshing...' : 'Refresh',
      icon: (
        <svg 
          className={`h-5 w-5 ${isLoading ? 'animate-spin' : ''}`} 
          xmlns="http://www.w3.org/2000/svg" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
      ),
      onClick: onRefresh || (() => {})
    });
  }

  return (
    <div className="relative">
      {/* Navbar */}
      <div className="flex items-center justify-between">
        <Logo size="large" className="text-white" />
        
        {/* Mobile menu button */}
        <button
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-white hover:text-gray-200 focus:outline-none"
        >
          <svg
            className="h-6 w-6"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            {showMobileMenu ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center space-x-3">
          {allActions.map((action, index) => (
            <div key={index} className={commonStyles.buttonPrimary.wrapper}>
              <div className={commonStyles.buttonPrimary.gradient} />
              <button
                onClick={action.onClick}
                className={`${commonStyles.buttonPrimary.content} !py-2 h-10 inline-flex items-center`}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Mobile menu */}
      {showMobileMenu && (
        <div className="md:hidden mt-4 space-y-3">
          {allActions.map((action, index) => (
            <div key={index} className={commonStyles.buttonPrimary.wrapper}>
              <div className={commonStyles.buttonPrimary.gradient} />
              <button
                onClick={() => {
                  action.onClick();
                  setShowMobileMenu(false);
                }}
                className={`${commonStyles.buttonPrimary.content} !py-2 h-10 inline-flex items-center w-full justify-center`}
              >
                <span className="mr-2">{action.icon}</span>
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Title (if provided) */}
      {title && (
        <h1 className={`${commonStyles.heading} mt-8`}>{title}</h1>
      )}
    </div>
  );
} 