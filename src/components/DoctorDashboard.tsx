import { useEffect, useState } from "react";
import { Calendar, CheckCircle, Clock, Mail, Phone, User, XCircle, Edit, Trash2, LogOut, ExternalLink } from "lucide-react";
import { BACKEND_URL } from "../config"; 

type Appointment = {
  id: number;
  client_name: string;
  client_email: string;
  client_mobile_no: string;   
  slot_time: string;          
  booking_date?: string; 
  booking_Date?: string; 
  is_approved: boolean;
  calendar_link?: string; // <-- Added this
};

export default function DoctorDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [isApproving, setIsApproving] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "" });

  const authHeaders = {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${token}`
  };

  const showToast = (msg: string, ok: boolean) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 3500);
  };

  const fetchAppointments = async (tab: "pending" | "approved") => {
    setIsLoading(true);
    try {
      const endpoint = tab === "approved" 
        ? `${BACKEND_URL}/doctor/approved` 
        : `${BACKEND_URL}/doctor/pendingappointments`;
        
      const res = await fetch(endpoint, { headers: authHeaders });
      if (res.status === 401) {
        onLogout();
        return;
      }
      
      const data = await res.json();
      setAppointments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Fetch error:", err);
      setAppointments([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments(activeTab);
  }, [activeTab]);

  const approveAppt = async (id: number) => {
    setIsApproving(true);
    try {
      const res = await fetch(`${BACKEND_URL}/doctor/approve/${id}`, {
        method: "POST",
        headers: authHeaders
      });
      const result = await res.json();
      if (res.ok) {
        showToast(`✓ ${result.client} approved! Calendar invite sent.`, true);
        await fetchAppointments(activeTab);
      } else {
        showToast(result.detail || "Approval failed.", false);
      }
    } catch {
      showToast("Approval failed. Check backend connection.", false);
    } finally {
      setIsApproving(false);
    }
  };

  const deleteAppt = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this appointment?")) return;
    try {
      const res = await fetch(`${BACKEND_URL}/doctor/delete/${id}`, {
        method: "DELETE",
        headers: authHeaders
      });
      if (res.ok) {
        showToast("✓ Appointment deleted successfully.", true);
        await fetchAppointments(activeTab);
      } else {
        showToast("Failed to delete appointment.", false);
      }
    } catch {
      showToast("Delete failed. Check backend connection.", false);
    }
  };

  const openEditModal = (apt: Appointment) => {
    setEditingAppt(apt);
    const actualDate = apt.booking_date || apt.booking_Date || "";
    setEditForm({ date: actualDate, time: apt.slot_time || "" });
  };

  const submitEdit = async () => {
    if (!editingAppt) return;
    try {
      const res = await fetch(`${BACKEND_URL}/doctor/updateappointment/${editingAppt.id}`, {
        method: "PATCH",
        headers: authHeaders,
        body: JSON.stringify({
          booking_date: editForm.date,
          slot_time: editForm.time,
        }),
      });

      if (res.ok) {
        showToast("✓ Appointment updated successfully.", true);
        setEditingAppt(null);
        await fetchAppointments(activeTab); 
      } else {
        showToast("Failed to update appointment.", false);
      }
    } catch {
      showToast("Update failed. Check backend connection.", false);
    }
  };

  const formatDateTime = (dateVal: string, slot_time: string) => {
    try {
      if (!dateVal || !slot_time) throw new Error("Missing data");
      const dt = new Date(`${dateVal}T${slot_time}`);
      if (isNaN(dt.getTime())) throw new Error("Invalid");
      return {
        dateStr: dt.toLocaleDateString("en-IN", { weekday: "short", year: "numeric", month: "long", day: "numeric" }),
        timeStr: dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      };
    } catch {
      return { dateStr: dateVal || "—", timeStr: slot_time || "—" };
    }
  };

  // Fallback Google Calendar URL generator
  const getCalendarDayLink = (dateString: string) => {
    const formattedDate = dateString.split('-').join('/'); 
    return `https://calendar.google.com/calendar/u/0/r/day/${formattedDate}`;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full shadow-xl text-sm font-semibold flex items-center gap-2 animate-in slide-in-from-top-4 ${
          toast.ok ? "bg-green-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.ok ? <CheckCircle size={18} /> : <XCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-gray-900 tracking-tight">Clinic Portal</h1>
            <p className="text-gray-500 text-sm mt-1">Manage your appointments</p>
          </div>
          <button onClick={onLogout} className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg transition hover:bg-red-100">
            <LogOut size={18} /> <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
          
          {/* Tabs */}
          <div className="border-b border-gray-200 flex">
            {(["pending", "approved"] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-5 text-center font-bold text-sm sm:text-base transition relative ${
                  activeTab === tab ? "text-blue-600" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  {tab === "pending" ? <Clock size={20} /> : <CheckCircle size={20} />}
                  {tab === "pending" ? "Pending Requests" : "Confirmed Appointments"}
                </div>
                {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-1 bg-blue-600 rounded-t-full" />}
              </button>
            ))}
          </div>

          {/* Loaders & Modals */}
          {isApproving && (
            <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4 animate-in zoom-in-95">
                <Loader2 size={48} className="text-blue-600 animate-spin" />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900">Syncing to Calendar</h3>
                  <p className="text-gray-500 text-sm">Approving and notifying patient...</p>
                </div>
              </div>
            </div>
          )}

          {/* Content Area */}
          <div className="p-4 sm:p-6 bg-slate-50/50 min-h-[400px]">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <Loader2 size={32} className="animate-spin mb-4 text-blue-600" />
                <p>Loading appointments...</p>
              </div>
            ) : appointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                {activeTab === 'pending' ? <Clock size={48} className="mb-4 opacity-50" /> : <Calendar size={48} className="mb-4 opacity-50" />}
                <p className="text-lg font-medium text-gray-600">No {activeTab} appointments</p>
                <p className="text-sm">When patients book, they will appear here.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {appointments.map((apt) => {
                  const actualDate = apt.booking_date || apt.booking_Date || "";
                  const { dateStr, timeStr } = formatDateTime(actualDate, apt.slot_time);
                  const calendarUrl = apt.calendar_link || getCalendarDayLink(actualDate);
                  
                  return (
                    <div key={apt.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition group">
                      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                        
                        {/* Patient Info */}
                        <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Patient</p>
                            <h3 className="font-bold text-gray-900 text-lg flex items-center gap-2">
                              <User size={18} className="text-blue-600" /> {apt.client_name}
                            </h3>
                            <div className="mt-2 space-y-1">
                              <p className="text-sm text-gray-600 flex items-center gap-2"><Phone size={14}/> {apt.whatsapp_no}</p>
                              <p className="text-sm text-gray-600 flex items-center gap-2"><Mail size={14}/> {apt.client_email}</p>
                            </div>
                          </div>
                          
                          <div className="bg-slate-50 p-3 rounded-lg border border-slate-100 h-fit">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1 flex items-center gap-1"><Calendar size={12}/> Schedule</p>
                            <p className="font-semibold text-gray-900">{dateStr}</p>
                            <p className="text-blue-700 font-bold">{timeStr}</p>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex flex-wrap items-center gap-3 lg:border-l lg:border-gray-100 lg:pl-6 pt-4 lg:pt-0 border-t border-gray-100">
                          {activeTab === "pending" ? (
                            <>
                              <button onClick={() => approveAppt(apt.id)} className="flex-1 sm:flex-none bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2 shadow-sm"><CheckCircle size={18} />Approve</button>
                              <button onClick={() => openEditModal(apt)} className="flex-1 sm:flex-none bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"><Edit size={18} />Edit</button>
                            </>
                          ) : (
                            <>
                              <a 
                                href={calendarUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex-1 sm:flex-none bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 px-4 py-2.5 rounded-lg font-bold transition flex items-center justify-center gap-2"
                              >
                                <Calendar size={18} /> View in Calendar <ExternalLink size={14} />
                              </a>
                            </>
                          )}
                          <button onClick={() => deleteAppt(apt.id)} className="flex-1 sm:flex-none bg-white hover:bg-red-50 text-red-600 border border-red-200 px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2">
                            <Trash2 size={18} />Delete
                          </button>
                        </div>

                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}