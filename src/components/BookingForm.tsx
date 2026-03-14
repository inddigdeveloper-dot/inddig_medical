import { useState, useEffect } from 'react';
import { Calendar, Clock, Mail, Phone, User, Loader2, MapPin } from 'lucide-react';


type FormState = 'idle' | 'submitting' | 'success' | 'error';
type GeoState = 'pending' | 'detecting' | 'granted' | 'denied';

function getBrowserTimezone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

/**
 * Builds an ISO 8601 string with the correct UTC offset for a given IANA timezone.
 * e.g. ("2026-03-15", "14:30", "Asia/Kolkata") → "2026-03-15T14:30:00+05:30"
 *
 * We treat the input date+time as a wall-clock time in the given timezone,
 * compute the UTC offset using Intl.DateTimeFormat, and append it.
 */
function buildISOWithTimezone(date: string, time: string, ianaTimezone: string): string {
  // Treat input as UTC baseline
  const utcEpoch = Date.UTC(
    parseInt(date.slice(0, 4)),
    parseInt(date.slice(5, 7)) - 1,
    parseInt(date.slice(8, 10)),
    parseInt(time.slice(0, 2)),
    parseInt(time.slice(3, 5)),
    0
  );

  // What wall-clock does the target timezone show for this UTC epoch?
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: ianaTimezone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(new Date(utcEpoch));

  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  const displayedEpoch = Date.UTC(
    parseInt(p.year), parseInt(p.month) - 1, parseInt(p.day),
    parseInt(p.hour === '24' ? '0' : p.hour), parseInt(p.minute), parseInt(p.second)
  );

  // offset in minutes: positive = east of UTC (e.g. +05:30 for IST)
  const offsetMinutes = (utcEpoch - displayedEpoch) / 60000;
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absMin = Math.abs(offsetMinutes);
  const hh = String(Math.floor(absMin / 60)).padStart(2, '0');
  const mm = String(absMin % 60).padStart(2, '0');

  return `${date}T${time}:00${sign}${hh}:${mm}`;
}

export default function BookingForm() {
  

  const [geoState, setGeoState] = useState<GeoState>('pending');
  const [timezone, setTimezone] = useState<string>('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const [formData, setFormData] = useState({
    client_name: '',
    client_email: '',
    mobile_no: '',
    slot_date: '',
    slot_time: '',
  });

  // Request geolocation on mount to confirm user's timezone
  useEffect(() => {
    if (!navigator.geolocation) {
      setTimezone(getBrowserTimezone());
      setGeoState('denied');
      return;
    }
    setGeoState('detecting');
    navigator.geolocation.getCurrentPosition(
      () => {
        // Granted — Intl API already knows the OS timezone, no need to reverse-geocode
        setTimezone(getBrowserTimezone());
        setGeoState('granted');
      },
      () => {
        // Denied / error — fall back to Intl timezone anyway
        setTimezone(getBrowserTimezone());
        setGeoState('denied');
      },
      { timeout: 8000 }
    );
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');
    setErrorMsg('');

    const tz = timezone || getBrowserTimezone();

    let isoSlotTime: string;
    try {
      isoSlotTime = buildISOWithTimezone(formData.slot_date, formData.slot_time, tz);
    } catch {
      isoSlotTime = `${formData.slot_date}T${formData.slot_time}:00Z`;
    }

    const payload = {
      client_name: formData.client_name,
      client_email: formData.client_email,
      mobile_no: formData.mobile_no,
      slot_time: isoSlotTime,  // e.g. "2026-03-15T14:30:00+05:30"
    };

    try {
      const response = await fetch('http://localhost:8000/makeappointements/drvijaydenyalhub', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        setFormState('success');
        setFormData({ client_name: '', client_email: '', mobile_no: '', slot_date: '', slot_time: '' });
      } else {
        setErrorMsg(data.detail || 'Submission failed.');
        setFormState('error');
      }
    } catch {
      setErrorMsg('Cannot connect to server. Please ensure the backend is running.');
      setFormState('error');
    }
  };

  const today = new Date().toISOString().split('T')[0];

  const previewISO = formData.slot_date && formData.slot_time && timezone
    ? (() => { try { return buildISOWithTimezone(formData.slot_date, formData.slot_time, timezone); } catch { return ''; } })()
    : '';

  // ── Success screen ──
  if (formState === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-xl p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Request Submitted!</h2>
          <p className="text-gray-500 mb-4 leading-relaxed">
            Your appointment request is pending Doctor's approval.<br />
            You'll receive a Google Calendar invite once confirmed.
          </p>
          <p className="text-xs text-gray-400 mb-6 font-mono bg-gray-50 px-3 py-2 rounded-lg">
            Timezone used: {timezone}
          </p>
          <button
            onClick={() => setFormState('idle')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition"
          >
            Book Another
          </button>
        </div>
      </div>
    );
  }

  // ── Main form ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-cyan-50 py-12 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Dr. Vijay Dental Hub</h1>
          <p className="text-gray-600">Book Your Appointment</p>
        </div>

        {/* Timezone / location banner */}
        <div className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium border ${
          geoState === 'detecting'
            ? 'bg-yellow-50 border-yellow-200 text-yellow-700'
            : geoState === 'granted'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-orange-50 border-orange-200 text-orange-700'
        }`}>
          <MapPin size={16} className="flex-shrink-0" />
          <span>
            {geoState === 'pending' && 'Waiting for location permission…'}
            {geoState === 'detecting' && 'Detecting your location for accurate scheduling…'}
            {geoState === 'granted' && `📍 Location confirmed — scheduling in: ${timezone}`}
            {geoState === 'denied' && `⚠ Location access denied — using browser timezone: ${timezone || getBrowserTimezone()}`}
          </span>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          <form onSubmit={handleSubmit} className="space-y-6">

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2"><User size={18} /> Full Name</div>
              </label>
              <input
                type="text" name="client_name" required
                value={formData.client_name} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2"><Mail size={18} /> Email Address</div>
              </label>
              <input
                type="email" name="client_email" required
                value={formData.client_email} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <div className="flex items-center gap-2"><Phone size={18} /> Mobile Number</div>
              </label>
              <input
                type="tel" name="mobile_no" required
                value={formData.mobile_no} onChange={handleChange}
                className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                placeholder="+91 98765 43210"
              />
            </div>

            {/* Separate Date + Time pickers */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2"><Calendar size={18} /> Preferred Date</div>
                </label>
                <input
                  type="date" name="slot_date" required
                  value={formData.slot_date} min={today}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <div className="flex items-center gap-2"><Clock size={18} /> Preferred Time</div>
                </label>
                <input
                  type="time" name="slot_time" required
                  value={formData.slot_time}
                  onChange={handleChange}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none transition"
                />
              </div>
            </div>

            {/* Live preview of the ISO string being sent */}
            {previewISO && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2.5 text-xs font-mono text-gray-500 flex items-center gap-2">
                <Clock size={12} className="flex-shrink-0 text-gray-400" />
                Sending to server: <span className="text-blue-700 font-semibold ml-1">{previewISO}</span>
              </div>
            )}

            {formState === 'error' && (
              <div className="p-4 rounded-lg border bg-red-50 text-red-800 border-red-200 text-sm">
                ⚠ {errorMsg}
              </div>
            )}

            <button
              type="submit"
              disabled={formState === 'submitting'}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-lg transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
            >
              {formState === 'submitting' ? (
                <><Loader2 className="animate-spin" size={20} /> Submitting…</>
              ) : (
                'Request Appointment'
              )}
            </button>

          </form>
        </div>

        <div className="mt-6 text-center">
          <button
            onClick={() => (window as any).navigate('/doctor-login')}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            Doctor Login →
          </button>
        </div>

      </div>
    </div>
  );
}