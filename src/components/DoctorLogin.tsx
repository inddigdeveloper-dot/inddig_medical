import { useState } from 'react';
import { Loader2, KeyRound, UserCircle, ArrowLeft, Phone, ShieldCheck, Lock, CheckCircle } from 'lucide-react';
import { BACKEND_URL } from '../config';

export default function DoctorLogin({
  onLoginSuccess,
  onNavigateRegister
}: {
  onLoginSuccess: (token: string) => void;
  onNavigateRegister: () => void;
}) {
  // --- View State ---
  const [view, setView] = useState<'login' | 'forgot'>('login');

  // --- Login State ---
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoginLoading, setIsLoginLoading] = useState(false);

  // --- Forgot Password State ---
  const [resetMobile, setResetMobile] = useState('');
  const [resetOtpState, setResetOtpState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified'>('idle');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetOtpError, setResetOtpError] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [isResetLoading, setIsResetLoading] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);

  // ==========================================
  // LOGIN LOGIC
  // ==========================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoginLoading(true);
    setLoginError('');

    const params = new URLSearchParams();
    params.append('username', identifier);
    params.append('password', password);

    try {
      const res = await fetch(`${BACKEND_URL}/doctor/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      });
      const data = await res.json();

      if (res.ok) {
        onLoginSuccess(data.access_token);
      } else {
        setLoginError(data.detail || 'Invalid credentials');
      }
    } catch {
      setLoginError('Network error connecting to backend.');
    } finally {
      setIsLoginLoading(false);
    }
  };

  // ==========================================
  // FORGOT PASSWORD LOGIC
  // ==========================================
  const handleSendResetOtp = async () => {
    if (!resetMobile) { setResetOtpError('Enter WhatsApp number'); return; }
    setResetOtpState('sending'); setResetOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/sendotp?phone_number=${encodeURIComponent(resetMobile)}`, { method: 'POST' });
      if (res.ok) setResetOtpState('sent');
      else setResetOtpError('Failed to send OTP');
    } catch {
      setResetOtpError('Network error'); setResetOtpState('idle');
    }
  };

  const handleVerifyResetOtp = async () => {
    if (!resetOtpCode) return;
    setResetOtpState('verifying'); setResetOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/verify_otp?phone_number=${encodeURIComponent(resetMobile)}&otp=${encodeURIComponent(resetOtpCode)}`);
      if (res.ok) setResetOtpState('verified');
      else { setResetOtpError('Invalid OTP'); setResetOtpState('sent'); }
    } catch {
      setResetOtpError('Network error'); setResetOtpState('sent');
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmNewPassword) {
      setResetError('Passwords do not match!');
      return;
    }

    setIsResetLoading(true);
    setResetError('');

    try {
      const res = await fetch(`${BACKEND_URL}/doctor/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: resetMobile,
          otp: resetOtpCode,        // Sending the OTP for backend security check
          password: newPassword     // Changing to "password" instead of "new_password"
        })
      });

      if (res.ok) {
        setResetSuccess(true);
      } else {
        const data = await res.json();
        setResetError(data.detail || 'Failed to reset password');
      }
    } catch {
      setResetError('Network error connecting to backend.');
    } finally {
      setIsResetLoading(false);
    }
  };

  // ==========================================
  // RENDER: FORGOT PASSWORD VIEW
  // ==========================================
  if (view === 'forgot') {
    if (resetSuccess) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center animate-in fade-in zoom-in-95">
            <div className="text-green-500 mb-4 flex justify-center"><CheckCircle size={60} /></div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Password Reset!</h2>
            <p className="text-gray-600 mb-6 text-sm">You can now login with your new password.</p>
            <button onClick={() => { setView('login'); setResetSuccess(false); setIdentifier(resetMobile); setPassword(''); }} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition shadow-md">
              Back to Login
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-6 animate-in fade-in slide-in-from-bottom-4">

          <button onClick={() => setView('login')} className="text-gray-500 hover:text-gray-800 flex items-center gap-2 text-sm font-medium transition">
            <ArrowLeft size={16} /> Back to Login
          </button>

          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Reset Password</h1>
            <p className="text-sm text-gray-500">Verify your registered WhatsApp number to create a new password.</p>
          </div>

          <form onSubmit={handleResetPasswordSubmit} className="space-y-5">
            {/* Step 1: Verify Phone */}
            <div className="bg-blue-50/50 p-4 sm:p-5 rounded-xl border border-blue-100">
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Phone size={16} /> WhatsApp Number
              </label>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <input
                  type="tel" required disabled={resetOtpState === 'verified' || resetOtpState === 'sent'}
                  value={resetMobile} onChange={e => setResetMobile(e.target.value)}
                  className="flex-1 w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-white/50"
                  placeholder="919876543210"
                />

                {resetOtpState === 'idle' && (
                  <button type="button" onClick={handleSendResetOtp} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-lg font-medium transition whitespace-nowrap">Verify</button>
                )}
                {resetOtpState === 'sending' && (
                  <button type="button" disabled className="w-full sm:w-auto bg-blue-400 text-white px-5 py-3 rounded-lg flex justify-center items-center gap-2"><Loader2 size={16} className="animate-spin" /></button>
                )}
                {resetOtpState === 'verified' && (
                  <div className="w-full sm:w-auto bg-green-100 text-green-700 px-5 py-3 rounded-lg font-medium flex justify-center items-center gap-2"><ShieldCheck size={20} /> Verified</div>
                )}
              </div>

              {(resetOtpState === 'sent' || resetOtpState === 'verifying') && (
                <div className="mt-3 flex flex-col sm:flex-row gap-2 sm:gap-3 animate-in fade-in slide-in-from-top-2">
                  <input type="text" placeholder="6-digit OTP" value={resetOtpCode} onChange={e => setResetOtpCode(e.target.value)} className="flex-1 w-full px-4 py-3 rounded-lg border border-blue-300 outline-none focus:ring-2 focus:ring-blue-500" />
                  <button type="button" onClick={handleVerifyResetOtp} disabled={resetOtpState === 'verifying'} className="w-full sm:w-auto bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-medium transition flex justify-center items-center">
                    {resetOtpState === 'verifying' ? <Loader2 size={16} className="animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              )}
              {resetOtpError && <p className="text-red-500 text-sm mt-2 font-medium">{resetOtpError}</p>}
            </div>

            {/* Step 2: New Password (Only visible after OTP is verified) */}
            {resetOtpState === 'verified' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-top-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Lock size={16} /> New Password</label>
                  <input
                    type="password" required value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Create new password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Lock size={16} /> Confirm Password</label>
                  <input
                    type="password" required value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                    placeholder="Repeat new password"
                  />
                </div>
              </div>
            )}

            {resetError && <div className="text-red-600 text-sm text-center font-medium bg-red-50 py-2 rounded-md border border-red-100">{resetError}</div>}

            <button
              type="submit"
              disabled={isResetLoading || resetOtpState !== 'verified'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 mt-4"
            >
              {isResetLoading ? <Loader2 className="animate-spin" size={20} /> : 'Save New Password'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER: LOGIN VIEW
  // ==========================================
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-6 sm:p-8 space-y-8 animate-in fade-in zoom-in-95">

        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Clinic Login</h1>
          <p className="text-sm text-gray-500">Access your appointment dashboard</p>
        </div>

        <form onSubmit={handleLoginSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <UserCircle size={16} className="text-gray-400" />
              Username, Email, or WhatsApp
            </label>
            <input
              type="text" required
              value={identifier} onChange={e => setIdentifier(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Enter your login ID"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
                <KeyRound size={16} className="text-gray-400" />
                Password
              </label>
              <button
                type="button"
                onClick={() => setView('forgot')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
              >
                Forgot password?
              </button>
            </div>
            <input
              type="password" required
              value={password} onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
              placeholder="Enter password"
            />
          </div>

          {loginError && <div className="text-red-700 text-sm text-center font-medium bg-red-50 py-2 rounded-md border border-red-100">{loginError}</div>}

          <button
            type="submit" disabled={isLoginLoading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition shadow-md flex justify-center items-center gap-2 disabled:opacity-70"
          >
            {isLoginLoading ? <Loader2 className="animate-spin" size={20} /> : 'Secure Login'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-600 border-t pt-6">
          Don't have an account?{' '}
          <button onClick={onNavigateRegister} className="text-blue-600 hover:text-blue-800 hover:underline font-semibold transition">
            Register your clinic
          </button>
        </div>
      </div>
    </div>
  );
}