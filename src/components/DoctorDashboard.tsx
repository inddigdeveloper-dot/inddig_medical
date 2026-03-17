import { useEffect, useState } from "react";
import { Calendar, CheckCircle, Clock, Mail, Phone, User, XCircle, Edit, Trash2, LogOut } from "lucide-react";

type Appointment = {
  id: number;
  client_name: string;
  client_email: string;
  client_mobile_no: string;   
  slot_time: string;          
  booking_date?: string; 
  booking_Date?: string; 
  is_approved: boolean;
};

export default function DoctorDashboard({ token, onLogout }: { token: string; onLogout: () => void }) {
  const [isApproving, setIsApproving] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [editForm, setEditForm] = useState({ date: "", time: "" });

  // Standard Header configuration for authenticated requests
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
        ? "http://localhost:8000/doctor/approved" 
        : "http://localhost:8000/doctor/pendingappointments";
        
      const res = await fetch(endpoint, { headers: authHeaders });
      if (res.status === 401) {
        onLogout(); // Token expired
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
      const res = await fetch(`http://localhost:8000/doctor/approve/${id}`, {
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
      const res = await fetch(`http://localhost:8000/doctor/delete/${id}`, {
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
      const res = await fetch(`http://localhost:8000/doctor/updateappointment/${editingAppt.id}`, {
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
        dateStr: dt.toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }),
        timeStr: dt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
      };
    } catch {
      return { dateStr: dateVal || "—", timeStr: slot_time || "—" };
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {toast && (
        <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium font-mono ${
          toast.ok ? "bg-green-700 text-white" : "bg-red-700 text-white"
        }`}>
          {toast.msg}
        </div>
      )}

      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Medical Portal</h1>
            <p className="text-gray-600 mt-1">Appointment Management Dashboard</p>
          </div>
          <button onClick={onLogout} className="text-red-600 hover:text-red-700 font-semibold flex items-center gap-2 bg-red-50 px-4 py-2 rounded-lg border border-red-100 hover:bg-red-100 transition">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="border-b border-gray-200">
            <nav className="flex">
              {(["pending", "approved"] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 px-6 py-4 text-center font-medium transition ${
                    activeTab === tab ? "bg-blue-600 text-white" : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {tab === "pending" ? <Clock size={20} /> : <CheckCircle size={20} />}
                    {tab === "pending" ? "Pending Requests" : "Approved Appointments"}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          {isApproving && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
                <div className="text-center">
                  <h3 className="text-xl font-bold text-gray-900">Approving Appointment</h3>
                  <p className="text-gray-500">Syncing with Google Calendar…</p>
                </div>
              </div>
            </div>
          )}

          {editingAppt && (
            <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
                <h3 className="text-xl font-bold text-gray-900 mb-4">Reschedule Appointment</h3>
                <p className="text-gray-600 mb-4">Editing for: <span className="font-semibold">{editingAppt.client_name}</span></p>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
                    <input type="date" value={editForm.date} onChange={(e) => setEditForm({...editForm, date: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600"/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
                    <input type="time" step="1" value={editForm.time} onChange={(e) => setEditForm({...editForm, time: e.target.value})} className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600"/>
                  </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                  <button onClick={() => setEditingAppt(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition">Cancel</button>
                  <button onClick={submitEdit} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition">Save Changes</button>
                </div>
              </div>
            </div>
          )}

          <div className="p-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
                <p className="mt-4 text-gray-600">Loading appointments…</p>
              </div>
            ) : appointments.length === 0 ? (
              <div className="text-center py-12">
                <XCircle size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 text-lg">No {activeTab} appointments found</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {appointments.map((apt) => {
                  const actualDate = apt.booking_date || apt.booking_Date || "";
                  const { dateStr, timeStr } = formatDateTime(actualDate, apt.slot_time);
                  
                  return (
                    <div key={apt.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          <div className="flex items-start gap-3"><User size={20} className="text-gray-500 mt-0.5" /><p className="font-semibold text-gray-900 text-lg">{apt.client_name}</p></div>
                          <div className="flex items-center gap-3"><Mail size={18} className="text-gray-500" /><p className="text-gray-700">{apt.client_email}</p></div>
                          <div className="flex items-center gap-3"><Phone size={18} className="text-gray-500" /><p className="text-gray-700">{apt.client_mobile_no}</p></div>
                          <div className="flex items-center gap-3"><Calendar size={18} className="text-gray-500" /><div><p className="text-gray-900 font-medium">{dateStr}</p><p className="text-gray-600 text-sm">{timeStr}</p></div></div>
                        </div>

                        <div className="flex flex-col sm:flex-row gap-3">
                          {activeTab === "pending" && (
                            <>
                              <button onClick={() => approveAppt(apt.id)} className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"><CheckCircle size={18} />Approve</button>
                              <button onClick={() => openEditModal(apt)} className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"><Edit size={18} />Edit</button>
                            </>
                          )}
                          {activeTab === "approved" && <span className="bg-green-100 text-green-800 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 h-fit"><CheckCircle size={16} />Confirmed</span>}
                          <button onClick={() => deleteAppt(apt.id)} className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 h-fit"><Trash2 size={18} />Delete</button>
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

// import { useEffect, useState } from "react";
// import {
//   Calendar,
//   CheckCircle,
//   Clock,
//   Mail,
//   Phone,
//   User,
//   XCircle,
//   Edit,
//   Trash2,
// } from "lucide-react";

// type Appointment = {
//   id: number;
//   client_name: string;
//   client_email: string;
//   client_mobile_no: string;   
//   slot_time: string;          
//   booking_date?: string; // Accepts lowercase
//   booking_Date?: string; // Accepts uppercase (SQLite legacy)
//   is_approved: boolean;
// };

// export default function DoctorDashboard() {
//   const [isApproving, setIsApproving] = useState(false);
//   const [activeTab, setActiveTab] = useState<"pending" | "approved">("pending");
//   const [appointments, setAppointments] = useState<Appointment[]>([]);
//   const [isLoading, setIsLoading] = useState(true);
//   const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

//   const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
//   const [editForm, setEditForm] = useState({ date: "", time: "" });

//   const showToast = (msg: string, ok: boolean) => {
//     setToast({ msg, ok });
//     setTimeout(() => setToast(null), 3500);
//   };

//   const fetchAppointments = async (tab: "pending" | "approved") => {
//     setIsLoading(true);
//     try {
//       const endpoint =
//         tab === "approved"
//           ? "http://localhost:8000/doctor/approved"
//           : "http://localhost:8000/doctor/pendingappointments";
//       const res = await fetch(endpoint);
//       const data = await res.json();
//       setAppointments(Array.isArray(data) ? data : []);
//     } catch (err) {
//       console.error("Fetch error:", err);
//       setAppointments([]);
//     } finally {
//       setIsLoading(false);
//     }
//   };

//   useEffect(() => {
//     fetchAppointments(activeTab);
//   }, [activeTab]);

//   const approveAppt = async (id: number) => {
//     setIsApproving(true);
//     try {
//       const res = await fetch(`http://localhost:8000/doctor/approve/${id}`, {
//         method: "POST",
//       });
//       const result = await res.json();
//       if (res.ok) {
//         showToast(`✓ ${result.client} approved! Calendar invite sent.`, true);
//         await fetchAppointments(activeTab);
//       } else {
//         showToast(result.detail || "Approval failed.", false);
//       }
//     } catch {
//       showToast("Approval failed. Check backend connection.", false);
//     } finally {
//       setIsApproving(false);
//     }
//   };

//   const deleteAppt = async (id: number) => {
//     if (!window.confirm("Are you sure you want to delete this appointment?")) return;
//     try {
//       const res = await fetch(`http://localhost:8000/doctor/delete/${id}`, {
//         method: "DELETE",
//       });
//       if (res.ok) {
//         showToast("✓ Appointment deleted successfully.", true);
//         await fetchAppointments(activeTab);
//       } else {
//         showToast("Failed to delete appointment.", false);
//       }
//     } catch {
//       showToast("Delete failed. Check backend connection.", false);
//     }
//   };

//   const openEditModal = (apt: Appointment) => {
//     setEditingAppt(apt);
//     // SAFELY grab the date whether the DB sent it as upper or lower case
//     const actualDate = apt.booking_date || apt.booking_Date || "";
//     setEditForm({ 
//       date: actualDate, 
//       time: apt.slot_time || "" 
//     });
//   };

//   const submitEdit = async () => {
//     if (!editingAppt) return;
//     try {
//       const res = await fetch(`http://localhost:8000/doctor/updateappointment/${editingAppt.id}`, {
//         method: "PATCH",
//         headers: { "Content-Type": "application/json" },
//         body: JSON.stringify({
//           booking_date: editForm.date, // Pydantic ALWAYS wants lowercase
//           slot_time: editForm.time,
//         }),
//       });

//       if (res.ok) {
//         showToast("✓ Appointment updated successfully.", true);
//         setEditingAppt(null);
//         await fetchAppointments(activeTab); 
//       } else {
//         showToast("Failed to update appointment.", false);
//       }
//     } catch {
//       showToast("Update failed. Check backend connection.", false);
//     }
//   };

//   const formatDateTime = (dateVal: string, slot_time: string) => {
//     try {
//       if (!dateVal || !slot_time) throw new Error("Missing data");
      
//       const isoLocal = `${dateVal}T${slot_time}`;
//       const dt = new Date(isoLocal);

//       if (isNaN(dt.getTime())) throw new Error("Invalid");

//       const dateStr = dt.toLocaleDateString("en-IN", {
//         weekday: "long",
//         year: "numeric",
//         month: "long",
//         day: "numeric",
//       });
//       const timeStr = dt.toLocaleTimeString("en-IN", {
//         hour: "2-digit",
//         minute: "2-digit",
//         hour12: true,
//       });
//       return { dateStr, timeStr };
//     } catch {
//       return { dateStr: dateVal || "—", timeStr: slot_time || "—" };
//     }
//   };

//   return (
//     <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">

//       {toast && (
//         <div className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-medium font-mono ${
//           toast.ok ? "bg-green-700 text-white" : "bg-red-700 text-white"
//         }`}>
//           {toast.msg}
//         </div>
//       )}

//       <div className="bg-white shadow-md border-b border-gray-200">
//         <div className="max-w-7xl mx-auto px-4 py-6">
//           <h1 className="text-3xl font-bold text-gray-900">Dr. Vijay Dental Hub</h1>
//           <p className="text-gray-600 mt-1">Appointment Management Dashboard</p>
//         </div>
//       </div>

//       <div className="max-w-7xl mx-auto px-4 py-8">
//         <div className="bg-white rounded-xl shadow-lg overflow-hidden">

//           <div className="border-b border-gray-200">
//             <nav className="flex">
//               {(["pending", "approved"] as const).map(tab => (
//                 <button
//                   key={tab}
//                   onClick={() => setActiveTab(tab)}
//                   className={`flex-1 px-6 py-4 text-center font-medium transition ${
//                     activeTab === tab
//                       ? "bg-blue-600 text-white"
//                       : "bg-gray-50 text-gray-600 hover:bg-gray-100"
//                   }`}
//                 >
//                   <div className="flex items-center justify-center gap-2">
//                     {tab === "pending" ? <Clock size={20} /> : <CheckCircle size={20} />}
//                     {tab === "pending" ? "Pending Requests" : "Approved Appointments"}
//                   </div>
//                 </button>
//               ))}
//             </nav>
//           </div>

//           {isApproving && (
//             <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
//               <div className="bg-white p-8 rounded-2xl shadow-2xl flex flex-col items-center gap-4">
//                 <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
//                 <div className="text-center">
//                   <h3 className="text-xl font-bold text-gray-900">Approving Appointment</h3>
//                   <p className="text-gray-500">Syncing with Google Calendar…</p>
//                 </div>
//               </div>
//             </div>
//           )}

//           {editingAppt && (
//             <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50">
//               <div className="bg-white p-6 rounded-2xl shadow-2xl w-full max-w-md">
//                 <h3 className="text-xl font-bold text-gray-900 mb-4">Reschedule Appointment</h3>
//                 <p className="text-gray-600 mb-4">Editing for: <span className="font-semibold">{editingAppt.client_name}</span></p>
                
//                 <div className="space-y-4">
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">New Date</label>
//                     <input 
//                       type="date" 
//                       value={editForm.date || ""}  
//                       onChange={(e) => setEditForm({...editForm, date: e.target.value})}
//                       className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600"
//                     />
//                   </div>
//                   <div>
//                     <label className="block text-sm font-medium text-gray-700 mb-1">New Time</label>
//                     <input 
//                       type="time" 
//                       step="1"
//                       value={editForm.time || ""} 
//                       onChange={(e) => setEditForm({...editForm, time: e.target.value})}
//                       className="w-full border border-gray-300 rounded-lg p-2 outline-none focus:ring-2 focus:ring-blue-600"
//                     />
//                   </div>
//                 </div>

//                 <div className="flex justify-end gap-3 mt-6">
//                   <button 
//                     onClick={() => setEditingAppt(null)}
//                     className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium transition"
//                   >
//                     Cancel
//                   </button>
//                   <button 
//                     onClick={submitEdit}
//                     className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition"
//                   >
//                     Save Changes
//                   </button>
//                 </div>
//               </div>
//             </div>
//           )}

//           <div className="p-6">
//             {isLoading ? (
//               <div className="text-center py-12">
//                 <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-blue-600 border-t-transparent" />
//                 <p className="mt-4 text-gray-600">Loading appointments…</p>
//               </div>
//             ) : appointments.length === 0 ? (
//               <div className="text-center py-12">
//                 <XCircle size={48} className="mx-auto text-gray-400 mb-4" />
//                 <p className="text-gray-600 text-lg">No {activeTab} appointments found</p>
//               </div>
//             ) : (
//               <div className="grid gap-4">
//                 {appointments.map((apt) => {
//                   // SAFELY grab the date regardless of how the database capitalized it
//                   const actualDate = apt.booking_date || apt.booking_Date || "";
//                   const { dateStr, timeStr } = formatDateTime(actualDate, apt.slot_time);
                  
//                   return (
//                     <div
//                       key={apt.id}
//                       className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition"
//                     >
//                       <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
//                         <div className="flex-1 space-y-3">

//                           <div className="flex items-start gap-3">
//                             <User size={20} className="text-gray-500 mt-0.5" />
//                             <p className="font-semibold text-gray-900 text-lg">{apt.client_name}</p>
//                           </div>

//                           <div className="flex items-center gap-3">
//                             <Mail size={18} className="text-gray-500" />
//                             <p className="text-gray-700">{apt.client_email}</p>
//                           </div>

//                           <div className="flex items-center gap-3">
//                             <Phone size={18} className="text-gray-500" />
//                             <p className="text-gray-700">{apt.client_mobile_no}</p>
//                           </div>

//                           <div className="flex items-center gap-3">
//                             <Calendar size={18} className="text-gray-500" />
//                             <div>
//                               <p className="text-gray-900 font-medium">{dateStr}</p>
//                               <p className="text-gray-600 text-sm">{timeStr}</p>
//                             </div>
//                           </div>

//                         </div>

//                         <div className="flex flex-col sm:flex-row gap-3">
//                           {activeTab === "pending" && (
//                             <>
//                               <button
//                                 onClick={() => approveAppt(apt.id)}
//                                 className="bg-green-600 hover:bg-green-700 text-white px-5 py-2.5 rounded-lg font-semibold transition shadow-sm hover:shadow-md flex items-center justify-center gap-2"
//                                 title="Approve Appointment"
//                               >
//                                 <CheckCircle size={18} />
//                                 Approve
//                               </button>
                              
//                               <button
//                                 onClick={() => openEditModal(apt)}
//                                 className="bg-blue-100 hover:bg-blue-200 text-blue-800 px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2"
//                                 title="Edit Date & Time"
//                               >
//                                 <Edit size={18} />
//                                 Edit
//                               </button>
//                             </>
//                           )}

//                           {activeTab === "approved" && (
//                             <span className="bg-green-100 text-green-800 px-4 py-2.5 rounded-lg text-sm font-medium flex items-center justify-center gap-2 h-fit">
//                               <CheckCircle size={16} />
//                               Confirmed
//                             </span>
//                           )}

//                           <button
//                             onClick={() => deleteAppt(apt.id)}
//                             className="bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 hover:border-red-300 px-4 py-2.5 rounded-lg font-semibold transition flex items-center justify-center gap-2 h-fit"
//                             title="Delete Appointment"
//                           >
//                             <Trash2 size={18} />
//                             Delete
//                           </button>
//                         </div>

//                       </div>
//                     </div>
//                   );
//                 })}
//               </div>
//             )}
//           </div>
//         </div>

//         <div className="mt-6 text-center">
//           <button
//             onClick={() => (window.location.href = "/")}
//             className="text-blue-600 hover:text-blue-700 text-sm font-medium"
//           >
//             ← Back to Booking
//           </button>
//         </div>
//       </div>
//     </div>
//   );
// }