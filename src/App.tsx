import { useState, useEffect } from 'react';
import BookingForm from './components/BookingForm';
import DoctorDashboard from './components/DoctorDashboard';
import DoctorLogin from './components/DoctorLogin';
import DoctorRegister from './components/DoctorRegister';

type Route = string;

export default function App() {
  // Use hash instead of pathname. Default to '#/' if empty.
  const [currentHash, setCurrentHash] = useState<Route>(window.location.hash || '#/');
  const [token, setToken] = useState<string>(localStorage.getItem('token') || '');

  useEffect(() => {
    // Listen for hash changes instead of popstate
    const handleHashChange = () => setCurrentHash(window.location.hash || '#/');
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  // Global navigate helper used by child components
  (window as any).navigate = (path: Route) => {
    window.location.hash = path; // Automatically triggers the hashchange event
  };

  const navigate = (path: Route) => {
    window.location.hash = path;
  };

  // ── Hash Routing ──
  if (currentHash === '#/doctor-login') {
    return (
      <DoctorLogin
        onLoginSuccess={(newToken) => {
          localStorage.setItem('token', newToken);
          setToken(newToken);
          navigate('#/doctor');
        }}
        onNavigateRegister={() => navigate('#/doctor-register')}
      />
    );
  }

  if (currentHash === '#/doctor-register') {
    return <DoctorRegister onNavigateLogin={() => navigate('#/doctor-login')} />;
  }

  if (currentHash === '#/doctor') {
    if (!token) {
      // Guard: not logged in → redirect to login
      navigate('#/doctor-login');
      return null;
    }
    return (
      <DoctorDashboard 
        token={token} 
        onLogout={() => {
          localStorage.removeItem('token');
          setToken('');
          navigate('#/doctor-login');
        }} 
      />
    );
  }

  // Default: Booking Form
  // Extract doctor username if URL is #/book/username, else default to your original doctor
  let doctorUsername = 'dr_vijay_dental';
  if (currentHash.startsWith('#/book/')) {
    doctorUsername = currentHash.split('/')[2] || 'dr_vijay_dental';
  }

  return <BookingForm doctorUsername={doctorUsername} />;
}

// import { useState, useEffect } from 'react';
// import BookingForm from './components/BookingForm';
// import DoctorDashboard from './components/DoctorDashboard';
// import DoctorLogin from './components/DoctorLogin';

// type Route = '/' | '/doctor-login' | '/doctor';

// export default function App() {
//   const [currentPath, setCurrentPath] = useState<Route>(
//     window.location.pathname as Route
//   );
//   const [doctorLoggedIn, setDoctorLoggedIn] = useState(false);

//   useEffect(() => {
//     const handlePop = () => setCurrentPath(window.location.pathname as Route);
//     window.addEventListener('popstate', handlePop);
//     return () => window.removeEventListener('popstate', handlePop);
//   }, []);

//   // Global navigate helper used by child components
//   (window as any).navigate = (path: Route) => {
//     window.history.pushState({}, '', path);
//     setCurrentPath(path);
//   };

//   const navigate = (path: Route) => {
//     window.history.pushState({}, '', path);
//     setCurrentPath(path);
//   };

//   // ── Routing ──
//   if (currentPath === '/doctor-login') {
//     return (
//       <DoctorLogin
//         onLoginSuccess={() => {
//           setDoctorLoggedIn(true);
//           navigate('/doctor');
//         }}
//       />
//     );
//   }

//   if (currentPath === '/doctor') {
//     if (!doctorLoggedIn) {
//       // Guard: not logged in → redirect to login
//       navigate('/doctor-login');
//       return null;
//     }
//     return <DoctorDashboard />;
//   }

//   // Default: '/'
//   return <BookingForm />;
// }
