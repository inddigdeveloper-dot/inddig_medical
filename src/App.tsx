import { useState, useEffect } from 'react';
import BookingForm from './components/BookingForm';
import DoctorDashboard from './components/DoctorDashboard';
import DoctorLogin from './components/DoctorLogin';

type Route = '/' | '/doctor-login' | '/doctor';

export default function App() {
  const [currentPath, setCurrentPath] = useState<Route>(
    window.location.pathname as Route
  );
  const [doctorLoggedIn, setDoctorLoggedIn] = useState(false);

  useEffect(() => {
    const handlePop = () => setCurrentPath(window.location.pathname as Route);
    window.addEventListener('popstate', handlePop);
    return () => window.removeEventListener('popstate', handlePop);
  }, []);

  // Global navigate helper used by child components
  (window as any).navigate = (path: Route) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  const navigate = (path: Route) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // ── Routing ──
  if (currentPath === '/doctor-login') {
    return (
      <DoctorLogin
        onLoginSuccess={() => {
          setDoctorLoggedIn(true);
          navigate('/doctor');
        }}
      />
    );
  }

  if (currentPath === '/doctor') {
    if (!doctorLoggedIn) {
      // Guard: not logged in → redirect to login
      navigate('/doctor-login');
      return null;
    }
    return <DoctorDashboard />;
  }

  // Default: '/'
  return <BookingForm />;
}
