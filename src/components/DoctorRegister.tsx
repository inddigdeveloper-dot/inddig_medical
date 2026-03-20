import { useState } from 'react';
import { Loader2, Phone, ShieldCheck, CheckCircle, User, Mail, Lock, Building2, Copy } from 'lucide-react';
import { BACKEND_URL } from '../config';

export default function DoctorRegister({ onNavigateLogin }: { onNavigateLogin: () => void }) {
  const [formData, setFormData] = useState({ 
    full_name: '', // Added full_name to match backend
    username: '', 
    email: '', 
    whatsapp_no: '', 
    password: '', 
    confirm_password: '' 
  });
  const [error, setError] = useState('');
  const [successLink, setSuccessLink] = useState(''); // Stores the generated booking link
  const [isLoading, setIsLoading] = useState(false);

  // OTP State
  const [otpState, setOtpState] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified'>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  const handleSendOtp = async () => {
    if (!formData.whatsapp_no) { setOtpError('Enter mobile number'); return; }
    setOtpState('sending'); setOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/sendotp?phone_number=${encodeURIComponent(formData.whatsapp_no)}`, { method: 'POST' });
      if (res.ok) setOtpState('sent');
      else setOtpError('Failed to send OTP');
    } catch {
      setOtpError('Network error'); setOtpState('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) return;
    setOtpState('verifying'); setOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/verify_otp?phone_number=${encodeURIComponent(formData.whatsapp_no)}&otp=${encodeURIComponent(otpCode)}`);
      if (res.ok) setOtpState('verified');
      else { setOtpError('Invalid OTP'); setOtpState('sent'); }
    } catch {
      setOtpError('Network error'); setOtpState('sent');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirm_password) {
      setError("Passwords do not match!");
      return;
    }
    if (otpState !== 'verified') {
      setError('Please verify your WhatsApp number first.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/doctor/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: formData.full_name, // Sent to backend
          username: formData.username,
          email: formData.email,
          whatsapp_no: formData.whatsapp_no,
          password: formData.password,
          confirm_password: formData.confirm_password
        })
      });

      const data = await res.json();
      if (res.ok) {
        setSuccessLink(data.booking_link); // Capture the link for the success screen
      } else {
        setError(data.detail || 'Registration failed');
      }
    } catch {
      setError('Network error connecting to backend.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- SUCCESS CONFIRMATION SCREEN ---
  if (successLink) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-8 px-4">
        <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 text-center animate-in zoom-in-95 duration-300">
          <div className="text-green-500 mb-6 flex justify-center">
            <div className="bg-green-50 p-4 rounded-full">
              <CheckCircle size={64} className="text-green-500" />
            </div>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-gray-900 mb-3">Registration Complete!</h2>
          <p className="text-gray-500 mb-8 text-sm sm:text-base leading-relaxed">
            Welcome, <strong>{formData.full_name}</strong>. Your clinic is now registered and ready to accept appointments.
          </p>
          
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-8 text-left">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Your Custom Booking Link</p>
            <div className="flex items-center gap-3">
              <p className="text-sm font-mono text-blue-600 break-all bg-blue-50 p-2 rounded flex-1">
                {successLink}
              </p>
              <button 
                onClick={() => navigator.clipboard.writeText(successLink)}
                className="text-gray-400 hover:text-gray-600 transition"
                title="Copy Link"
              >
                <Copy size={20} />
              </button>
            </div>
          </div>

          <button onClick={onNavigateLogin} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-200 active:scale-[0.98]">
            Proceed to Login
          </button>
        </div>
      </div>
    );
  }

  // --- REGISTRATION FORM ---
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center py-10 px-4 sm:px-6">
      <div className="max-w-xl w-full bg-white rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-black text-gray-900 mb-2 text-center">Create Account</h1>
          <p className="text-gray-500 text-center text-sm sm:text-base mb-8">Register your clinic to start accepting bookings</p>
          
          <form onSubmit={handleSubmit} className="space-y-5">
            
            {/* ADDED: Full Name Field */}
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 size={14}/> Clinic / Doctor Name</label>
              <input
                type="text" required
                value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50 focus:bg-white"
                placeholder="e.g. Dr. Smith Dental"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><User size={14}/> Username</label>
                <input
                  type="text" required
                  value={formData.username} onChange={e => setFormData({...formData, username: e.target.value.toLowerCase().replace(/\s/g, '_')})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50 focus:bg-white"
                  placeholder="e.g. city_dental"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Mail size={14}/> Email</label>
                <input
                  type="email" required
                  value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50 focus:bg-white"
                  placeholder="dr@example.com"
                />
              </div>
            </div>

            {/* WhatsApp OTP Section - Made Fully Responsive */}
            <div className="bg-blue-50/50 p-4 sm:p-5 rounded-2xl border border-blue-100 space-y-3">
              <label className="block text-xs font-bold text-blue-700 uppercase tracking-wider flex items-center gap-1.5">
                <Phone size={14} /> WhatsApp Verification
              </label>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel" required disabled={otpState === 'verified' || otpState === 'sent'}
                  value={formData.whatsapp_no} onChange={e => setFormData({...formData, whatsapp_no: e.target.value})}
                  className="flex-1 w-full px-4 py-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-white/60 bg-white"
                  placeholder="919876543210"
                />
                
                {otpState === 'idle' && (
                  <button type="button" onClick={handleSendOtp} className="w-full sm:w-auto bg-blue-600 text-white px-6 py-3 rounded-xl font-bold transition-all hover:bg-blue-700 active:scale-95 shadow-sm">Verify</button>
                )}
                {otpState === 'sending' && (
                  <button type="button" disabled className="w-full sm:w-auto bg-blue-400 text-white px-6 py-3 rounded-xl flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /></button>
                )}
                {otpState === 'verified' && (
                  <div className="w-full sm:w-auto bg-green-100 text-green-700 px-4 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-green-200"><ShieldCheck size={20} /> <span className="sm:hidden">Verified</span></div>
                )}
              </div>

              {(otpState === 'sent' || otpState === 'verifying') && (
                <div className="flex flex-col sm:flex-row gap-3 pt-2 animate-in fade-in slide-in-from-top-2">
                  <input type="text" placeholder="6-digit OTP" value={otpCode} onChange={e => setOtpCode(e.target.value)} className="flex-1 w-full px-4 py-3 rounded-xl border border-blue-300 outline-none bg-white focus:ring-2 focus:ring-blue-500"/>
                  <button type="button" onClick={handleVerifyOtp} disabled={otpState === 'verifying'} className="w-full sm:w-auto bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-all active:scale-95 flex justify-center items-center gap-2 shadow-sm">
                    {otpState === 'verifying' ? <Loader2 size={18} className="animate-spin" /> : 'Confirm'}
                  </button>
                </div>
              )}
              {otpError && <p className="text-red-500 text-xs font-semibold mt-1">{otpError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Lock size={14}/> Password</label>
                <input
                  type="password" required
                  value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Lock size={14}/> Confirm</label>
                <input
                  type="password" required
                  value={formData.confirm_password} onChange={e => setFormData({...formData, confirm_password: e.target.value})}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 outline-none transition bg-gray-50/50 focus:bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            {error && <div className="text-red-600 text-sm font-semibold bg-red-50 p-3 rounded-xl border border-red-100 text-center animate-in zoom-in-95">{error}</div>}
            
            <button
              type="submit"
              disabled={isLoading || otpState !== 'verified'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl transition-all shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:shadow-none active:scale-[0.99] mt-4 flex items-center justify-center gap-2"
            >
              {isLoading ? <Loader2 className="animate-spin" size={24} /> : 'Complete Registration'}
            </button>
          </form>

          <div className="mt-8 text-center pt-6 border-t border-gray-100">
            <p className="text-gray-500 text-sm">
              Already a member?{' '}
              <button onClick={onNavigateLogin} className="text-blue-600 hover:text-blue-800 font-bold hover:underline transition">Sign in here</button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}