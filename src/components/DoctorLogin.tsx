import { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function DoctorLogin({ 
  onLoginSuccess, 
  onNavigateRegister 
}: { 
  onLoginSuccess: (token: string) => void;
  onNavigateRegister: () => void;
}) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    // FastAPI's OAuth2PasswordRequestForm requires x-www-form-urlencoded
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', password);

    try {
      const res = await fetch('http://localhost:8000/doctor/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: params
      });

      const data = await res.json();

      if (res.ok) {
        onLoginSuccess(data.access_token);
      } else {
        setError(data.detail || 'Invalid credentials');
      }
    } catch {
      setError('Network error connecting to backend.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-12 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">Doctor Login</h1>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
            <input
              type="text" required
              value={username} onChange={e => setUsername(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              placeholder="Enter password"
            />
          </div>
          
          {error && <div className="text-red-600 text-sm text-center font-medium bg-red-50 py-2 rounded-md">{error}</div>}
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition shadow-lg hover:shadow-xl flex justify-center items-center gap-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-600 border-t pt-4">
          Don't have an account?{' '}
          <button onClick={onNavigateRegister} className="text-blue-600 hover:underline font-semibold">
            Register your clinic
          </button>
        </div>
      </div>
    </div>
  );
}

// import { useState } from 'react';
// import { Loader2 } from 'lucide-react';

// export default function DoctorLogin({ onLoginSuccess }: { onLoginSuccess: () => void }) {
//   const [mode, setMode] = useState<'login' | 'register' | 'register_otp'>('login');
  
//   const [username, setUsername] = useState('');
//   const [password, setPassword] = useState('');
//   const [whatsapp, setWhatsapp] = useState('');
//   const [otp, setOtp] = useState('');
  
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');
//   const [successMsg, setSuccessMsg] = useState('');

//   const handleLogin = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true); setError('');
    
//     // OAuth2 Form Data format
//     const formData = new URLSearchParams();
//     formData.append('username', username);
//     formData.append('password', password);

//     try {
//       const res = await fetch('http://localhost:8000/doctor/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
//         body: formData,
//       });
//       const data = await res.json();
      
//       if (res.ok) {
//         localStorage.setItem('token', data.access_token);
//         onLoginSuccess();
//       } else {
//         setError(data.detail || 'Invalid credentials');
//       }
//     } catch {
//       setError('Connection failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleRequestRegisterOTP = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true); setError('');
//     try {
//       const res = await fetch(`http://localhost:8000/sendotp?phone_number=${encodeURIComponent(whatsapp)}`, { method: 'POST' });
//       if (res.ok) setMode('register_otp');
//       else setError('Failed to send OTP to WhatsApp.');
//     } catch {
//       setError('Connection failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleVerifyAndRegister = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true); setError('');
//     try {
//       // 1. Verify OTP
//       const otpRes = await fetch(`http://localhost:8000/verify_otp?phone_number=${encodeURIComponent(whatsapp)}&otp=${encodeURIComponent(otp)}`);
//       if (!otpRes.ok) throw new Error('Invalid OTP');

//       // 2. Register Doctor
//       const regRes = await fetch('http://localhost:8000/doctor/register', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ username, password }) 
//         // Note: Update backend DoctorCreate schema if you want to pass 'whatsapp_no' here
//       });
//       const data = await regRes.json();
      
//       if (regRes.ok) {
//         setSuccessMsg(`Registered successfully! Your booking link is: ${data.booking_link}`);
//         setTimeout(() => setMode('login'), 4000);
//       } else {
//         setError(data.detail || 'Registration failed');
//       }
//     } catch (err: any) {
//       setError(err.message || 'Verification failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-12 px-4">
//       <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8">
//         <h1 className="text-3xl font-bold text-gray-900 mb-2 text-center">
//           {mode === 'login' ? 'Doctor Login' : 'Doctor Registration'}
//         </h1>
//         {successMsg && <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">{successMsg}</div>}
//         {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">{error}</div>}

//         {mode === 'login' && (
//           <form onSubmit={handleLogin} className="space-y-5">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
//               <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" placeholder="dr_vijay_dental" />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
//               <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" placeholder="••••••••" />
//             </div>
//             <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
//               {loading ? <Loader2 className="animate-spin inline" size={20} /> : 'Login'}
//             </button>
//             <p className="text-center text-sm text-gray-500 mt-4">
//               New doctor? <button type="button" onClick={() => setMode('register')} className="text-blue-600 hover:underline">Register here</button>
//             </p>
//           </form>
//         )}

//         {mode === 'register' && (
//           <form onSubmit={handleRequestRegisterOTP} className="space-y-5">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Choose Username</label>
//               <input type="text" required value={username} onChange={e => setUsername(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Choose Password</label>
//               <input type="password" required value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" />
//             </div>
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Number</label>
//               <input type="tel" required value={whatsapp} onChange={e => setWhatsapp(e.target.value)} className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" placeholder="919876543210" />
//             </div>
//             <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
//               {loading ? <Loader2 className="animate-spin inline" size={20} /> : 'Send OTP to Verify'}
//             </button>
//             <p className="text-center text-sm text-gray-500 mt-4">
//               Already registered? <button type="button" onClick={() => setMode('login')} className="text-blue-600 hover:underline">Login</button>
//             </p>
//           </form>
//         )}

//         {mode === 'register_otp' && (
//           <form onSubmit={handleVerifyAndRegister} className="space-y-5">
//             <div>
//               <label className="block text-sm font-medium text-gray-700 mb-1">Enter WhatsApp OTP</label>
//               <input type="text" required maxLength={6} value={otp} onChange={e => setOtp(e.target.value)} className="w-full text-center text-xl tracking-widest px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500" placeholder="------" />
//             </div>
//             <button type="submit" disabled={loading} className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-lg transition disabled:opacity-50">
//               {loading ? <Loader2 className="animate-spin inline" size={20} /> : 'Verify & Create Account'}
//             </button>
//             <button type="button" onClick={() => setMode('register')} className="w-full text-center text-sm text-gray-500 mt-2">Go Back</button>
//           </form>
//         )}
//       </div>
//     </div>
//   );
// }
