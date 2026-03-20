import { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, Phone, User, Loader2, MapPin, CheckCircle, ShieldCheck } from 'lucide-react';
import { BACKEND_URL } from '../config';

type FormState = 'idle' | 'submitting' | 'success' | 'error';
type GeoState = 'pending' | 'detecting' | 'granted' | 'denied';
type OtpState = 'idle' | 'sending' | 'sent' | 'verifying' | 'verified';

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export default function BookingForm({ doctorUsername }: { doctorUsername: string }) {
  const [geoState, setGeoState] = useState<GeoState>('pending');
  const [timezone, setTimezone] = useState<string>('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  // OTP State
  const [otpState, setOtpState] = useState<OtpState>('idle');
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');

  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    mobile_no: '',
    slot_date: '',
    slot_time: '',
  });

  useEffect(() => {
    if (navigator.geolocation) {
      setGeoState('detecting');
      navigator.geolocation.getCurrentPosition(
        () => {
          setTimezone('Asia/Kolkata');
          setGeoState('granted');
        },
        () => {
          setTimezone('Asia/Kolkata');
          setGeoState('denied');
        }
      );
    } else {
      setTimezone('Asia/Kolkata');
      setGeoState('denied');
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSendOtp = async () => {
    if (!formData.mobile_no) {
      setOtpError('Enter WhatsApp number');
      return;
    }
    setOtpState('sending');
    setOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/sendotp?phone_number=${encodeURIComponent(formData.mobile_no)}`, { method: 'POST' });
      if (res.ok) setOtpState('sent');
      else {
        const data = await res.json();
        setOtpError(data.detail || 'Failed to send OTP');
        setOtpState('idle');
      }
    } catch {
      setOtpError('Network error connecting to backend.');
      setOtpState('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode) return;
    setOtpState('verifying');
    setOtpError('');
    try {
      const res = await fetch(`${BACKEND_URL}/verify_otp?phone_number=${encodeURIComponent(formData.mobile_no)}&otp=${encodeURIComponent(otpCode)}`);
      if (res.ok) setOtpState('verified');
      else {
        const data = await res.json();
        setOtpError(data.detail || 'Invalid OTP');
        setOtpState('sent');
      }
    } catch {
      setOtpError('Network error connecting to backend.');
      setOtpState('sent');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otpState !== 'verified') {
      setErrorMsg('Please verify your WhatsApp number first.');
      return;
    }

    setFormState('submitting');
    const isoSlotTime = `${formData.slot_date}T${formData.slot_time}:00`;

    const payload = {
      client_name: formData.client_name,
      client_email: formData.client_email,
      mobile_no: formData.mobile_no,
      slot_time: isoSlotTime,
      user_timezone: "Asia/Kolkata"
    };

    try {
      const response = await fetch(`${BACKEND_URL}/book/${doctorUsername}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        setFormState('success');
      } else {
        const data = await response.json();
        setErrorMsg(data.detail || 'Submission failed.');
        setFormState('error');
      }
    } catch {
      setErrorMsg('Cannot connect to server.');
      setFormState('error');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-5xl mb-4 flex justify-center"><CheckCircle className="text-green-500 w-16 h-16" /></div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
          <p className="text-gray-500 mb-6 leading-relaxed text-sm sm:text-base">
            Your appointment request is pending Doctor's approval.<br />
            You'll receive a Calendar invite once confirmed.
          </p>
          <button
            onClick={() => {
              setFormState('idle'); setOtpState('idle'); setOtpCode('');
              setFormData({ client_name: '', client_email: '', mobile_no: '', slot_date: '', slot_time: '' });
            }}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3.5 rounded-xl transition"
          >
            Book Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-8 px-4 sm:py-12">
      <div className="max-w-2xl mx-auto w-full">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">Book Appointment</h1>
          <p className="text-gray-600 text-sm sm:text-base">Requesting slot with: <span className="font-bold text-blue-700">@{doctorUsername}</span></p>
        </div>

        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><User size={18} /> Full Name</label>
              <input type="text" name="client_name" required value={formData.client_name} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="Enter full name" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Mail size={18} /> Email Address</label>
              <input type="email" name="client_email" required value={formData.client_email} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition" placeholder="your@email.com" />
            </div>

            {/* RESPONSIVE OTP SECTION */}
            <div className="bg-blue-50/50 p-4 sm:p-5 rounded-xl border border-blue-100">
              <label className="block text-sm font-bold text-blue-800 mb-3 flex items-center gap-2"><Phone size={16} /> WhatsApp Verification</label>
              
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="tel" name="mobile_no" required disabled={otpState === 'verified' || otpState === 'sent'}
                  value={formData.mobile_no} onChange={handleChange}
                  className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-blue-200 focus:ring-2 focus:ring-blue-500 outline-none transition disabled:bg-white/50"
                  placeholder="919876543210"
                />
                
                {otpState === 'idle' && (
                  <button type="button" onClick={handleSendOtp} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition-all shadow-sm">Verify</button>
                )}
                {otpState === 'sending' && (
                  <button type="button" disabled className="w-full sm:w-auto bg-blue-400 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2"><Loader2 size={18} className="animate-spin" /> Sending</button>
                )}
                {otpState === 'verified' && (
                  <div className="w-full sm:w-auto bg-green-100 text-green-700 px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 border border-green-200"><ShieldCheck size={20} /> Verified</div>
                )}
              </div>

              {(otpState === 'sent' || otpState === 'verifying') && (
                <div className="mt-3 flex flex-col sm:flex-row gap-3 animate-in fade-in slide-in-from-top-2">
                  <input
                    type="text" placeholder="6-digit OTP" value={otpCode} onChange={e => setOtpCode(e.target.value)}
                    className="w-full sm:flex-1 px-4 py-3 rounded-xl border border-blue-300 focus:ring-2 focus:ring-blue-500 outline-none bg-white"
                  />
                  <div className="flex gap-2">
                    <button type="button" onClick={handleVerifyOtp} disabled={otpState === 'verifying'} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-xl font-bold transition flex items-center justify-center gap-2">
                      {otpState === 'verifying' ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />} Confirm
                    </button>
                    <button type="button" onClick={() => {setOtpState('idle'); setOtpCode('');}} className="px-4 py-3 rounded-xl text-gray-500 hover:bg-gray-100 font-medium transition">
                      Cancel
                    </button>
                  </div>
                </div>
              )}
              {otpError && <p className="text-red-500 text-sm mt-2 font-medium">{otpError}</p>}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Calendar size={18} /> Date</label>
                <input type="date" name="slot_date" required value={formData.slot_date} min={today} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2"><Clock size={18} /> Time</label>
                <input type="time" name="slot_time" required value={formData.slot_time} onChange={handleChange} className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition" />
              </div>
            </div>

            {formState === 'error' && <div className="p-3 sm:p-4 rounded-xl border bg-red-50 text-red-800 border-red-200 text-sm font-medium text-center">⚠ {errorMsg}</div>}

            <button type="submit" disabled={formState === 'submitting' || otpState !== 'verified'} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition shadow-lg hover:shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center justify-center gap-2 mt-2">
              {formState === 'submitting' ? <><Loader2 className="animate-spin" size={20} /> Submitting...</> : otpState !== 'verified' ? 'Verify WhatsApp to Book' : 'Request Appointment'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}