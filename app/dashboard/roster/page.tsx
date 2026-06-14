"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../../context/AuthContext";
import { collection, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { db } from "../../../lib/firebase";
import { Edit2, Check, X, Trash2, CalendarClock, ShieldAlert, UserPlus, Users } from "lucide-react";

interface Employee {
  id: string;
  name: string;
  position: string;
  wageRate: number;
  email?: string;
  role: string;
  availability?: any; // Kept flexible to handle both booleans and strings
}

export default function RosterPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const isAdmin = user?.role === "admin";
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ position: "", wageRate: 0, role: "" });
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);

  const fetchRoster = async () => {
    if (!user?.restaurantId) return;
    try {
      const usersRef = collection(db, "restaurants", user.restaurantId, "users");
      const snapshot = await getDocs(usersRef);
      let staffList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<Employee, 'id'>)
      }));

      staffList.sort((a, b) => {
        const posA = (a.position || "").toLowerCase();
        const posB = (b.position || "").toLowerCase();
        if (posA < posB) return -1;
        if (posA > posB) return 1;
        const getLastName = (name: string) => name.split(" ").pop()?.toLowerCase() || "";
        return getLastName(a.name).localeCompare(getLastName(b.name));
      });

      setEmployees(staffList);
    } catch (error) {
      console.error("Error fetching roster:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchRoster();
  }, [user?.restaurantId]);

  const handleEditClick = (emp: Employee) => {
    if (!isAdmin) return;
    setEditingId(emp.id);
    setEditForm({ position: emp.position || "", wageRate: emp.wageRate || 0, role: emp.role || "team_member" });
  };

  const handleSaveClick = async (empId: string) => {
    if (!user?.restaurantId || !isAdmin) return;
    try {
      const empRef = doc(db, "restaurants", user.restaurantId, "users", empId);
      await updateDoc(empRef, {
        position: editForm.position,
        wageRate: Number(editForm.wageRate),
        role: editForm.role
      });
      setEmployees(employees.map(emp => emp.id === empId ? { ...emp, ...editForm, wageRate: Number(editForm.wageRate) } : emp));
      setEditingId(null);
    } catch (error) {
      console.error("Error updating employee:", error);
      alert("Failed to update employee.");
    }
  };

  const handleDelete = async (id: string) => {
    if (!user?.restaurantId || !isAdmin) return;
    if (id === user.uid) {
      alert("Action denied: You cannot delete your own admin account.");
      return;
    }
    if (!window.confirm("Are you certain you want to remove this employee from the system?")) return;
    try {
      const itemRef = doc(db, "restaurants", user.restaurantId, "users", id);
      await deleteDoc(itemRef);
      setEmployees(employees.filter(emp => emp.id !== id));
    } catch (error) {
      console.error("Error deleting employee:", error);
    }
  };

  const formatName = (fullName: string) => {
    const parts = fullName.split(" ");
    if (parts.length === 1) return fullName;
    const last = parts.pop();
    const first = parts.join(" ");
    return `${last}, ${first}`;
  };

  if (isLoading) return <div className="p-8">Loading staff roster...</div>;

  return (
    <div className="p-8 max-w-7xl mx-auto w-full relative">
      <div className="mb-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Staff Roster</h1>
          <p className="text-gray-500 mt-2">
            View team members, availability, and positions.
            {!isAdmin && " (View-Only Mode)"}
          </p>
        </div>
        {isAdmin && (
          <button className="flex items-center gap-2 bg-[#005088] hover:bg-[#003f6b] text-white px-4 py-2 rounded-lg font-medium transition-colors">
            <UserPlus size={20} /> Add New Hire
          </button>
        )}
      </div>

      {!isAdmin && (
        <div className="mb-6 bg-blue-50 text-blue-800 p-4 rounded-lg flex items-center gap-3 border border-blue-100">
          <ShieldAlert size={20} className="text-blue-600" />
          <span className="text-sm font-medium">You are viewing this roster as a Manager. Wage editing and staff removal are restricted to Administrators.</span>
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200 text-sm font-semibold text-gray-600">
                <th className="p-4">Name (Last, First)</th>
                <th className="p-4">Position</th>
                <th className="p-4 text-center">System Role</th>
                {isAdmin && <th className="p-4 text-center">Hourly Rate</th>}
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {employees.map((emp) => {
                const isEditing = editingId === emp.id;
                const isCurrentUser = emp.id === user?.uid;

                return (
                  <tr key={emp.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900">{formatName(emp.name)}</span>
                        {isCurrentUser && <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase">You</span>}
                      </div>
                      <div className="text-sm text-gray-500">{emp.email || "No email linked"}</div>
                    </td>
                    <td className="p-4">
                      {isEditing ? (
                        <input type="text" value={editForm.position} onChange={(e) => setEditForm({...editForm, position: e.target.value})} className="w-full px-2 py-1 border border-gray-400 rounded text-gray-900 focus:ring-2 focus:ring-[#005088] outline-none" />
                      ) : (
                        <span className="capitalize font-medium text-gray-700">{emp.position}</span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      {isEditing ? (
                        <select value={editForm.role} onChange={(e) => setEditForm({...editForm, role: e.target.value})} className="px-2 py-1 border border-gray-400 rounded text-gray-900 bg-white outline-none">
                          <option value="team_member">Team Member</option>
                          <option value="manager">Manager</option>
                          <option value="admin">Admin</option>
                        </select>
                      ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                          emp.role === 'admin' ? 'bg-red-100 text-red-700' :
                          emp.role === 'manager' ? 'bg-blue-100 text-blue-700' :
                          'bg-gray-100 text-gray-700'
                        }`}>
                          {emp.role.replace('_', ' ')}
                        </span>
                      )}
                    </td>
                    {isAdmin && (
                      <td className="p-4 text-center">
                        {isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <span className="text-gray-500">$</span>
                            <input type="number" step="0.25" value={editForm.wageRate} onChange={(e) => setEditForm({...editForm, wageRate: Number(e.target.value)})} className="w-20 px-2 py-1 border border-gray-400 rounded text-gray-900 outline-none" />
                          </div>
                        ) : (
                          <span className="font-medium text-gray-900">${Number(emp.wageRate || 0).toFixed(2)}</span>
                        )}
                      </td>
                    )}
                    <td className="p-4 text-right">
                      {isEditing ? (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setEditingId(null)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><X size={18} /></button>
                          <button onClick={() => handleSaveClick(emp.id)} className="p-2 text-[#11CAA0] hover:bg-teal-50 rounded-lg transition-colors"><Check size={18} /></button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setSelectedEmp(emp)} className="flex items-center gap-1 p-2 text-gray-500 hover:text-[#005088] hover:bg-blue-50 rounded-lg transition-colors" title="View Availability">
                            <CalendarClock size={18} />
                          </button>
                          {isAdmin && (
                            <>
                              <button onClick={() => handleEditClick(emp)} className="p-2 text-gray-400 hover:text-[#005088] hover:bg-blue-50 rounded-lg transition-colors"><Edit2 size={18} /></button>
                              {!isCurrentUser && (
                                <button onClick={() => handleDelete(emp.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18} /></button>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {selectedEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50">
              <div>
                <h2 className="text-lg font-bold text-gray-900">{formatName(selectedEmp.name)}</h2>
                <p className="text-sm text-gray-500 capitalize">{selectedEmp.position} • Availability</p>
              </div>
              <button onClick={() => setSelectedEmp(null)} className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded-lg transition-colors">
                <X size={20} />
              </button>
            </div>
            <div className="p-5">
              {selectedEmp.availability ? (
                <ul className="space-y-3">
                  {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => {
                    const val = (selectedEmp.availability as any)[day];
                    
                    // Logic to handle boolean OR string values
                    let displayLabel = "Unavailable";
                    let style = "bg-red-100 text-red-700";
                    
                    if (val === true || val === "All Day") {
                      displayLabel = "All Day";
                      style = "bg-green-100 text-green-700";
                    } else if (val === "Lunch Only") {
                      displayLabel = "Lunch";
                      style = "bg-yellow-100 text-yellow-700";
                    } else if (val === "Dinner Only") {
                      displayLabel = "Dinner";
                      style = "bg-blue-100 text-blue-700";
                    }

                    return (
                      <li key={day} className="flex justify-between items-center p-2 rounded hover:bg-gray-50 border-b border-gray-100">
                        <span className="font-semibold text-gray-900 w-24">{day}</span>
                        <span className={`text-sm font-bold px-2 py-1 rounded ${style}`}>
                          {displayLabel}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="text-center py-8 text-gray-500 italic">No availability data entered yet.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}