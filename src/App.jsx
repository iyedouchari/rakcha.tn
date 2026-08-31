import React, { useEffect } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useRakchaStore } from './store/useRakchaStore';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import CreateProfile from './pages/CreateProfile';
import Dashboard from './pages/Dashboard';
import CreateJoinGroup from './pages/CreateJoinGroup';
import Settings from './pages/Settings';
import CheckEmail from './pages/CheckEmail';
import EmailConfirmed from './pages/EmailConfirmed';
import Toast from './components/Toast';

const pageTransitionVariants = {
  initial: (shouldReduce) => ({
    opacity: 0,
    y: shouldReduce ? 0 : 10,
    scale: shouldReduce ? 1 : 0.99,
    filter: shouldReduce ? 'none' : 'blur(4px)'
  }),
  animate: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.35,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: (shouldReduce) => ({
    opacity: 0,
    y: shouldReduce ? 0 : -8,
    scale: shouldReduce ? 1 : 0.99,
    filter: shouldReduce ? 'none' : 'blur(4px)',
    transition: {
      duration: 0.22,
      ease: 'easeInOut'
    }
  })
};

export default function App() {
  const currentPage = useRakchaStore((s) => s.currentPage);
  const syncRoute = useRakchaStore((s) => s.syncRoute);
  const initAuth = useRakchaStore((s) => s.initAuth);
  const currentUser = useRakchaStore((s) => s.currentUser);
  const authInitialized = useRakchaStore((s) => s.authInitialized);
  const showToast = useRakchaStore((s) => s.showToast);
  const navigate = useRakchaStore((s) => s.navigate);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    // Override window.alert to use our custom Toast component
    window.alert = (msg) => {
      showToast(msg);
    };

    initAuth();

    // Check if returning from email confirmation
    if (window.location.hash.includes('type=signup') || window.location.hash.includes('access_token')) {
      // Let Supabase handle the token, then redirect to our success page
      setTimeout(() => {
        navigate('email-confirmed');
      }, 500);
    }

    const handleHashChange = () => {
      let page = window.location.hash.replace('#/', '') || 'landing';
      if (page.includes('access_token') || page.includes('type=signup')) {
        // Ignore hash changes caused by auth tokens directly
        return;
      }
      syncRoute(page);
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [syncRoute, showToast, navigate, initAuth]);

  // Keep authenticated users directly inside the app if they are on landing or login
  useEffect(() => {
    if (authInitialized) {
      if (currentUser && (!currentPage || currentPage === 'landing' || currentPage === 'login' || currentPage === 'register')) {
        navigate('app');
      } else if (!currentUser && (!window.location.hash || window.location.hash === '#/' || window.location.hash === '#/landing')) {
        if (currentPage !== 'landing') {
          syncRoute('landing');
        }
      }
    }
  }, [authInitialized, currentUser, currentPage, navigate, syncRoute]);

  const getActiveComponent = () => {
    if (!authInitialized && !['landing', 'login', 'register', 'check-email', 'email-confirmed'].includes(currentPage)) {
      return (
        <div className="min-h-screen bg-[#0B0E14] flex flex-col items-center justify-center relative overflow-hidden">
          <div className="w-16 h-16 relative flex items-center justify-center animate-pulse">
            <img src="/logo.png" alt="Rakcha" className="w-14 h-14 object-contain drop-shadow-[0_0_25px_rgba(99,102,241,0.7)]" />
          </div>
        </div>
      );
    }

    if (!currentUser && !['landing', 'login', 'register', 'check-email', 'email-confirmed', 'create-profile'].includes(currentPage)) {
      return <Login />;
    }

    switch (currentPage) {
      case 'landing':
        return <Landing />;
      case 'login':
        return <Login />;
      case 'register':
        return <Register />;
      case 'check-email':
        return <CheckEmail />;
      case 'email-confirmed':
        return <EmailConfirmed />;
      case 'create-profile':
        return <CreateProfile />;
      case 'app':
        return <Dashboard />;
      case 'create-join':
        return <CreateJoinGroup />;
      case 'settings':
        return <Settings />;
      default:
        return currentUser ? <Dashboard /> : <Landing />;
    }
  };

  const activeKey = !currentUser && !['landing', 'login', 'register', 'check-email', 'email-confirmed', 'create-profile'].includes(currentPage)
    ? 'auth-login'
    : currentPage;

  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary/30 selection:text-white relative">
      <Toast />
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={activeKey}
          custom={shouldReduceMotion}
          variants={pageTransitionVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="min-h-screen w-full flex flex-col"
        >
          {getActiveComponent()}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
