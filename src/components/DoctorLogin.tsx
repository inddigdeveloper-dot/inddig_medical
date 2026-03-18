import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { BACKEND_URL } from '../config';

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
      const res = await fetch(`${BACKEND_URL}/doctor/login`, {
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
