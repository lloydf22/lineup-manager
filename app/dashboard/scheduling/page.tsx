"use client";

import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, writeBatch, query } from "firebase/firestore";
import { Calendar, Clock, Plus, Trash2, Loader2, ChevronLeft, ChevronRight, DollarSign, Sparkles, Sliders, AlertTriangle, CheckCircle2 } from "lucide-react";

import { 
  Shift, 
  Employee, 
  TimeOffRequest,
  PositionDemand,
  PRESET_SHIFTS, 
  formatToRosterDayString, 
  calculateHoursFromString, 
  calculateWeeklyLaborCost,
  getUniqueCompanyPositions,
  sortEmployeesByPositionAndLastName,
  isEmployeeUnavailable
} from "./rosterUtils";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "lineup-72c1e.firebaseapp.com",
  projectId: "lineup-72c1e",
  storageBucket: "lineup-72c1e.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

export default function SchedulingPage() {
  const restaurantId = "golden-lion";

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [timeOff, setTimeOff] = useState<TimeOffRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(today.setDate(diff));
  });

  // Daily Headcount Configurator State
  const [demands, setDemands] = useState<PositionDemand>({});
  const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);

  // Modal Context Controllers
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [targetDateString, setTargetDateString] = useState("");
  const [shiftRole, setShiftRole] = useState("server");
  
  // Custom Override Time State
  const [isCustomTime, setIsCustomTime] = useState(false);
  const [customStartTime, setCustomStartTime] = useState("11:00 AM");
  const [customEndTime, setCustomEndTime] = useState("4:00 PM");
  const [customTier, setCustomTier] = useState("Lunch");

  const getWeekDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const nextDay = new Date(currentWeekStart);
      nextDay.setDate(currentWeekStart.getDate() + i);
      days.push(nextDay);
    }
    return days;
  };

  const weekDays = getWeekDays();

  useEffect(() => {
    setLoading(true);
    
    // 1. Stream Active Employee Profiles
    const usersQuery = collection(db, "restaurants", restaurantId, "users");
    const unsubUsers = onSnapshot(usersQuery, (snapshot) => {
      const roster = snapshot.docs.map(d => {
        const rawData = d.data();
        let activeRate = 15.00;
        if (rawData.wageRate !== undefined && rawData.wageRate !== null) {
          activeRate = Number(rawData.wageRate);
        }

        return { 
          id: d.id, 
          name: rawData.name || "Unnamed Staff", 
          position: rawData.position, 
          role: rawData.role || "team_member", 
          wageRate: activeRate,
          availability: rawData.availability
        };
      });
      setEmployees(sortEmployeesByPositionAndLastName(roster));
    });

    // 2. Stream Time Off Requests
    const timeOffQuery = collection(db, "restaurants", restaurantId, "time_off_requests");
    const unsubTimeOff = onSnapshot(timeOffQuery, (snapshot) => {
      const requests = snapshot.docs.map(d => {
        const rawData = d.data();
        return {
          id: d.id,
          uid: rawData.uid || "",
          name: rawData.name || "",
          startDate: rawData.startDate?.toDate() || new Date(), 
          endDate: rawData.endDate?.toDate() || new Date(),
          status: rawData.status || "Pending"
        };
      });
      setTimeOff(requests);
    });

    // 3. Stream and filter roster shifts in-memory to bypass alphabetical string bugs
    const rosterQuery = query(collection(db, "restaurants", restaurantId, "roster"));
    const unsubRoster = onSnapshot(rosterQuery, (snapshot) => {
      const validWeekDayStrings = weekDays.map(day => formatToRosterDayString(day));

      const activeShifts = snapshot.docs
        .map(d => ({
          id: d.id,
          serverName: d.get("staff") || "",
          role: d.get("role") || "server",
          displayDayString: d.get("day") || "",
          displayTimeRange: d.get("time") || "",
          tier: d.get("tier") || "Lunch",
         }))
        .filter(shift => validWeekDayStrings.includes(shift.displayDayString));

      setShifts(activeShifts);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubTimeOff();
      unsubRoster();
    };
  }, [currentWeekStart]);

  const getEmployeeCurrentWeeklyHours = (employeeName: string, localShiftsBuffer: Shift[] = shifts): number => {
    let total = 0;
    weekDays.forEach((day) => {
      const dayStr = formatToRosterDayString(day);
      const matchingDayShifts = localShiftsBuffer.filter(
        s => s.serverName.toLowerCase() === employeeName.toLowerCase() && s.displayDayString === dayStr
      );
      matchingDayShifts.forEach(s => {
        total += calculateHoursFromString(s.displayTimeRange);
      });
    });
    return total;
  };

  const getPositionTarget = (dayStr: string, tier: string, position: string): number => {
    return demands[dayStr]?.[tier]?.[position] ?? (tier === "Lunch" ? 1 : 2); 
  };

  const updatePositionTarget = (dayStr: string, tier: string, position: string, val: number) => {
    setDemands(prev => ({
      ...prev,
      [dayStr]: {
        ...prev[dayStr],
        [tier]: {
          ...(prev[dayStr]?.[tier]),
          [position]: Math.max(0, val)
        }
      }
    }));
  };

  const openCellAssignment = (employeeName: string, dateObj: Date) => {
    const matchEmp = employees.find(e => e.name.toLowerCase() === employeeName.toLowerCase()) || null;
    if (matchEmp) {
      const check = isEmployeeUnavailable(matchEmp, dateObj, timeOff);
      if (check.unavailable) {
        window.alert(`Aborted: ${matchEmp.name} has a conflict on this day due to an [${check.reason}].`);
        return;
      }
    }

    setSelectedEmployee(matchEmp);
    setTargetDateString(formatToRosterDayString(dateObj));
    setIsCustomTime(false);

    if (matchEmp) {
      if (matchEmp.role === "admin") {
        setShiftRole("server"); 
      } else if (matchEmp.role === "manager") {
        if (Array.isArray(matchEmp.position) && matchEmp.position.length > 0) {
          setShiftRole(matchEmp.position[0].toLowerCase());
        } else if (typeof matchEmp.position === 'string' && matchEmp.position.length > 0) {
          setShiftRole(matchEmp.position.toLowerCase());
        } else {
          setShiftRole("manager");
        }
      } else if (Array.isArray(matchEmp.position) && matchEmp.position.length > 0) {
        setShiftRole(matchEmp.position[0].toLowerCase());
      } else if (typeof matchEmp.position === 'string' && matchEmp.position.length > 0) {
        setShiftRole(matchEmp.position.toLowerCase());
      } else {
        setShiftRole("server");
      }
    } else {
      setShiftRole("server");
    }
    setIsModalOpen(true);
  };

  const handleSelectPreset = async (timeRange: string, tier: string) => {
    if (!selectedEmployee) return;

    const currentHours = getEmployeeCurrentWeeklyHours(selectedEmployee.name);
    const incomingHours = calculateHoursFromString(timeRange);
    const projectedHours = currentHours + incomingHours;

    if (projectedHours > 40.0) {
      const confirmOverride = window.confirm(
        `⚠️ Overtime Warning!\n\nAssigning this shift will push ${selectedEmployee.name} to ${projectedHours.toFixed(1)} hours for this week.\n\nAre you sure you want to assign this shift?`
      );
      if (!confirmOverride) return; 
    }

    try {
      await addDoc(collection(db, "restaurants", restaurantId, "roster"), {
        staff: selectedEmployee.name,
        role: shiftRole,
        day: targetDateString,
        time: timeRange,
        tier: tier,
        timestamp: new Date(),
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error creating preset shift card:", err);
    }
  };

  const handleCustomShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee) return;

    const timeRangeStr = `${customStartTime} - ${customEndTime}`;
    const currentHours = getEmployeeCurrentWeeklyHours(selectedEmployee.name);
    const incomingHours = calculateHoursFromString(timeRangeStr);
    const projectedHours = currentHours + incomingHours;

    if (projectedHours > 40.0) {
      const confirmOverride = window.confirm(
        `⚠️ Overtime Warning!\n\nAssigning this custom shift will push ${selectedEmployee.name} to ${projectedHours.toFixed(1)} hours for this week.\n\nAre you sure you want to assign this shift?`
      );
      if (!confirmOverride) return; 
    }

    try {
      await addDoc(collection(db, "restaurants", restaurantId, "roster"), {
        staff: selectedEmployee.name,
        role: shiftRole,
        day: targetDateString,
        time: timeRangeStr,
        tier: customTier,
        timestamp: new Date(),
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error("Error generating custom timeline bounds:", err);
    }
  };

  // --- UPGRADED "FAIR-SHARE" DEMAND-BASED AUTO-FILL ENGINE ---
  const handleAutoFillWeek = async () => {
    const batch = writeBatch(db);
    const companyActivePositions = getUniqueCompanyPositions(employees);
    
    // Create a mutable local shift buffer to dynamically calculate hours and coverage count in memory
    let temporaryShiftsBuffer = [...shifts];

    // 1. Loop Chronologically through each day of the week
    weekDays.forEach((day) => {
      const dateStr = formatToRosterDayString(day);

      // 2. Loop through each shift tier (Lunch, then Dinner)
      ["Lunch", "Dinner"].forEach((tier) => {
        const presetPattern = tier === "Lunch" ? PRESET_SHIFTS[1] : PRESET_SHIFTS[2];
        const incomingHours = calculateHoursFromString(presetPattern.time);

        // 3. Loop through each individual active job station role
        companyActivePositions.forEach((pos) => {
          const requiredTargetCount = getPositionTarget(dateStr, tier, pos);
          
          // Check how many people are already scheduled manually for this slot
          let currentFilledCount = temporaryShiftsBuffer.filter(
            s => s.displayDayString === dateStr && s.tier === tier && s.role.toLowerCase() === pos.toLowerCase()
          ).length;

          if (currentFilledCount >= requiredTargetCount) return; 

          // 4. Find qualified, available staff profiles who match this specific position
          const eligibleStaff = employees.filter((emp) => {
            if (emp.role === "admin") return false; 

            // Verify position match
            const matchesPosition = Array.isArray(emp.position)
              ? emp.position.map(p => p.toLowerCase()).includes(pos.toLowerCase())
              : emp.position?.toLowerCase() === pos.toLowerCase();

            if (!matchesPosition) return false;

            // Verify they aren't blocked by general availability or approved time-off
            const statusCheck = isEmployeeUnavailable(emp, day, timeOff);
            if (statusCheck.unavailable) return false;

            // Verify they aren't already working a shift during this exact tier block
            const isAlreadyWorkingTier = temporaryShiftsBuffer.some(
              s => s.serverName.toLowerCase() === emp.name.toLowerCase() && s.displayDayString === dateStr && s.tier === tier
            );
            if (isAlreadyWorkingTier) return false;

            return true;
          });

          // --- DYNAMIC LEVELING PASS ---
          // Sort available staff on the fly so whoever has the FEWEST total weekly hours up to this point gets picked first
          const leveledStaff = [...eligibleStaff].sort((a, b) => {
            const hoursA = getEmployeeCurrentWeeklyHours(a.name, temporaryShiftsBuffer);
            const hoursB = getEmployeeCurrentWeeklyHours(b.name, temporaryShiftsBuffer);
            return hoursA - hoursB; 
          });

          // 5. Allocate leveled staff until the quota ceiling is satisfied
          for (let i = 0; i < leveledStaff.length; i++) {
            if (currentFilledCount >= requiredTargetCount) break;

            const selectedStaff = leveledStaff[i];
            
            // Check overtime headroom limit before auto-filling
            const currentWeeklyHours = getEmployeeCurrentWeeklyHours(selectedStaff.name, temporaryShiftsBuffer);
            if (currentWeeklyHours + incomingHours > 40.0) continue; 

            // Stage document parameters into firestore write batch
            const newShiftRef = doc(collection(db, "restaurants", restaurantId, "roster"));
            const newShiftObject = {
              staff: selectedStaff.name,
              role: pos.toLowerCase().trim(),
              day: dateStr,
              time: presetPattern.time,
              tier: tier,
              timestamp: new Date(),
            };

            batch.set(newShiftRef, newShiftObject);

            // Push to local buffer so subsequent checks evaluate updates instantly
            temporaryShiftsBuffer.push({
              id: newShiftRef.id,
              serverName: selectedStaff.name,
              role: pos.toLowerCase().trim(),
              displayDayString: dateStr,
              displayTimeRange: presetPattern.time,
              tier: tier,
            });

            currentFilledCount++;
          }
        });
      });
    });

    try {
      await batch.commit();
      console.log("Roster auto-filled with fair-share hour distribution!");
    } catch (err) {
      console.error("Auto-Fill engine processing crash:", err);
    }
  };

  const handleClearWeekSchedule = async () => {
    if (shifts.length === 0) {
      window.alert("There are no shifts scheduled on this week's layout to clear.");
      return;
    }

    const confirmClear = window.confirm(
      `🚨 WARNING: Destructive Action!\n\nYou are about to delete ALL (${shifts.length}) scheduled shifts for this visible week viewport.\n\nThis cannot be undone. Are you sure you want to wipe the schedule?`
    );
    if (!confirmClear) return;

    setLoading(true);
    const batch = writeBatch(db);
    shifts.forEach((shift) => {
      const shiftDocRef = doc(db, "restaurants", restaurantId, "roster", shift.id);
      batch.delete(shiftDocRef);
    });

    try {
      await batch.commit();
    } catch (err) {
      console.error("Batch deletion transaction failed:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteShift = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); 
    try {
      await deleteDoc(doc(db, "restaurants", restaurantId, "roster", id));
    } catch (err) {
      console.error("Error clearing documentation slot node:", err);
    }
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const nextWeek = new Date(currentWeekStart);
    nextWeek.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(nextWeek);
  };

  const weeklyLaborCostForecast = calculateWeeklyLaborCost(shifts, employees);
  const companyActivePositions = getUniqueCompanyPositions(employees);

  return (
    <div className="p-8 max-w-7xl mx-auto w-full min-h-screen bg-gray-50">
      
      {/* SUMMARY PANELS */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="bg-emerald-50 p-3 rounded-lg text-emerald-600"><DollarSign size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Weekly Labor Forecast</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">${weeklyLaborCostForecast.toFixed(2)}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-blue-50 p-3 rounded-lg text-[#005088]"><Sliders size={24} /></div>
            <div>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dynamic Staffing Controls</p>
              <p className="text-sm font-black text-slate-700 mt-1">Configure Daily Headcounts</p>
            </div>
          </div>
          <button 
            onClick={() => setIsConfigPanelOpen(!isConfigPanelOpen)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${isConfigPanelOpen ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
          >
            {isConfigPanelOpen ? "Close Customizer" : "Modify Targets"}
          </button>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-xs flex items-center gap-4">
          <div className="bg-amber-50 p-3 rounded-lg text-amber-600"><Clock size={24} /></div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Weekly Shift Blocks</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{shifts.length} Assigned</p>
          </div>
        </div>
      </div>

      {/* DYNAMIC DAILY CONFIGURATOR PANEL */}
      {isConfigPanelOpen && (
        <div className="bg-white p-6 rounded-xl border border-amber-200 bg-amber-50/10 shadow-xs mb-8 animate-in fade-in slide-in-from-top-3 duration-200">
          <h2 className="text-sm font-black text-gray-800 uppercase tracking-wider mb-4 flex items-center gap-2 text-[#005088]"><Sliders size={16} /> Fine-Tune Dynamic Staffing Demands For This Week</h2>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
            {weekDays.map(day => {
              const dayStr = formatToRosterDayString(day);
              return (
                <div key={`cfg-${dayStr}`} className="border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                  <p className="text-xs font-bold text-gray-700 mb-2">{dayStr}</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {["Lunch", "Dinner"].map(tier => (
                      <div key={tier} className="space-y-2 bg-white p-2 rounded border border-gray-100">
                        <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">{tier} Tier</span>
                        {companyActivePositions.map(pos => (
                          <div key={pos} className="flex items-center justify-between text-xs font-medium text-gray-600 gap-2">
                            <span className="capitalize text-[11px]">{pos}s:</span>
                            <input 
                              type="number" 
                              value={getPositionTarget(dayStr, tier, pos)} 
                              onChange={(e) => updatePositionTarget(dayStr, tier, pos, parseInt(e.target.value) || 0)}
                              className="w-10 bg-gray-50 border border-gray-200 rounded text-center p-0.5 font-bold outline-none focus:border-[#005088]"
                            />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Action Header Nav Module */}
      <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Shift Scheduler</h1>
          <p className="text-gray-500 text-sm">Organized alphabetically by last name within each functional staff department.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-white rounded-lg border border-gray-200 shadow-2xs overflow-hidden">
            <button onClick={() => navigateWeek('prev')} className="p-2.5 hover:bg-gray-100 transition-colors border-r border-gray-200"><ChevronLeft size={18} /></button>
            <span className="px-4 font-bold text-sm text-gray-700 whitespace-nowrap">Week of {weekDays[0].toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
            <button onClick={() => navigateWeek('next')} className="p-2.5 hover:bg-gray-100 transition-colors border-l border-gray-200"><ChevronRight size={18} /></button>
          </div>
          <button onClick={handleClearWeekSchedule} className="flex items-center gap-2 bg-rose-50 text-rose-600 border border-rose-200 px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-rose-100 transition-all shadow-3xs"><Trash2 size={16} /> Clear Week</button>
          <button onClick={handleAutoFillWeek} className="flex items-center gap-2 bg-purple-600 text-white px-4 py-2.5 rounded-lg font-bold text-sm hover:bg-purple-700 transition-all shadow-sm"><Sparkles size={16} /> Auto-Fill Template</button>
        </div>
      </div>

      {/* WEEK CALENDAR GRID INTERFACE MODULE */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="grid grid-cols-8 border-b border-gray-200 bg-gray-100/70 text-center font-bold text-xs text-gray-500 tracking-wider uppercase">
          <div className="p-4 text-left border-r border-gray-200 bg-gray-100">Staff Registry</div>
          {weekDays.map((day) => (
            <div key={day.toString()} className="p-4 border-r border-gray-200 last:border-0">
              <div>{day.toLocaleDateString(undefined, { weekday: 'short' })}</div>
              <div className="text-base font-black text-gray-800 mt-0.5">{day.getDate()}</div>
            </div>
          ))}
        </div>

        <div className="divide-y divide-gray-200">
          {employees.map((emp) => {
            const totalWeeklyHours = getEmployeeCurrentWeeklyHours(emp.name);
            const isOvertimeBypassed = totalWeeklyHours > 40.0;

            return (
              <div key={emp.id} className="grid grid-cols-8 min-h-[110px]">
                {/* Left Staff Meta Cell */}
                <div className="p-4 border-r border-gray-200 bg-gray-50/30 flex flex-col justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm leading-tight">{emp.name}</p>
                    <p className="text-[10px] text-gray-400 mt-1 capitalize font-black tracking-wider bg-gray-100 px-2 py-0.5 rounded inline-block">
                      {Array.isArray(emp.position) ? emp.position[0] : (emp.position || "floor staff")}
                    </p>
                  </div>
                  <div className={`text-[10px] font-black tracking-wider mt-2 uppercase flex items-center gap-1 ${isOvertimeBypassed ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`}>
                    <span>Hours: {totalWeeklyHours.toFixed(1)}h</span>
                    {isOvertimeBypassed && <AlertTriangle size={12} className="text-rose-600" />}
                  </div>
                </div>

                {/* Day Columns Map Matrix */}
                {weekDays.map((day) => {
                  const targetRosterDayStr = formatToRosterDayString(day);
                  const matchingShifts = shifts.filter(
                    s => s.serverName.toLowerCase() === emp.name.toLowerCase() && s.displayDayString === targetRosterDayStr
                  );

                  const statusCheck = isEmployeeUnavailable(emp, day, timeOff);

                  return (
                    <div 
                      key={day.toString()} 
                      onClick={() => openCellAssignment(emp.name, day)}
                      className={`p-2 border-r border-gray-200 last:border-0 flex flex-col gap-1.5 transition-colors overflow-y-auto group relative ${
                        statusCheck.unavailable 
                          ? 'bg-rose-50/70 hover:bg-rose-100/60 cursor-not-allowed' 
                          : 'bg-white hover:bg-slate-50/60 cursor-pointer'
                      }`}
                    >
                      {matchingShifts.map((shift) => (
                        <div key={shift.id} className="p-2 rounded-lg border text-xs bg-blue-50/60 border-blue-200 text-blue-900 group/card transition-all shadow-3xs">
                          <div className="font-bold flex items-center justify-between">
                            <span className="capitalize">{shift.role}</span>
                            <button onClick={(e) => handleDeleteShift(e, shift.id)} className="text-gray-400 hover:text-red-600 transition-colors opacity-0 group-hover/card:opacity-100"><Trash2 size={11} /></button>
                          </div>
                          <div className="flex items-center gap-1 mt-1 text-[11px] font-medium opacity-80"><Clock size={10} />{shift.displayTimeRange}</div>
                          <div className="mt-1 text-[9px] font-bold text-blue-500 uppercase tracking-widest">{shift.tier}</div>
                        </div>
                      ))}

                      {statusCheck.unavailable && (
                        <div className="m-auto text-center flex flex-col items-center gap-1 text-rose-500 font-bold text-[10px] uppercase tracking-wider select-none">
                          <AlertTriangle size={14} />
                          <span>{statusCheck.reason === "Approved Time-Off Request" ? "Time Off" : "No Avail"}</span>
                        </div>
                      )}

                      {matchingShifts.length === 0 && !statusCheck.unavailable && (
                        <div className="m-auto opacity-0 group-hover:opacity-100 transition-all text-slate-300 group-hover:text-[#005088]">
                          <Plus size={16} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* COVERAGE SCORECARD PANEL FOOTER */}
        <div className="grid grid-cols-8 border-t border-gray-200 bg-slate-900 text-white font-medium text-[11px]">
          <div className="p-4 border-r border-gray-800 bg-gray-950 font-bold text-slate-400 uppercase tracking-wider flex items-center">Coverage Monitor</div>
          {weekDays.map((day) => {
            const targetDayStr = formatToRosterDayString(day);
            const dayShifts = shifts.filter(s => s.displayDayString === targetDayStr);

            return (
              <div key={`metrics-${day.toString()}`} className="p-2 border-r border-gray-800 last:border-0 flex flex-col gap-3 justify-center">
                {["Lunch", "Dinner"].map(tier => {
                  const tierShifts = dayShifts.filter(s => s.tier === tier);
                  
                  let tierHasUnderstaffing = false;
                  companyActivePositions.forEach(pos => {
                    const scheduledCount = tierShifts.filter(s => s.role.toLowerCase() === pos.toLowerCase()).length;
                    const requiredCount = getPositionTarget(targetDayStr, tier, pos);
                    if (scheduledCount < requiredCount) tierHasUnderstaffing = true;
                  });

                  return (
                    <div key={tier} className="space-y-1 bg-slate-850 p-1.5 rounded border border-slate-800">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-1 mb-1">
                        <span className="text-slate-400 font-bold uppercase text-[9px]">{tier}</span>
                        <span className={tierHasUnderstaffing ? 'text-amber-400' : 'text-emerald-400'}>
                          {tierHasUnderstaffing ? <AlertTriangle size={10} /> : <CheckCircle2 size={10} />}
                        </span>
                      </div>
                      {companyActivePositions.map(pos => {
                        const count = tierShifts.filter(s => s.role.toLowerCase() === pos.toLowerCase()).length;
                        const target = getPositionTarget(targetDayStr, tier, pos);
                        return (
                          <div key={pos} className="flex items-center justify-between font-mono text-[10px]">
                            <span className="capitalize text-slate-500 truncate max-w-[40px]">{pos}:</span>
                            <span className={count < target ? 'text-amber-500 font-bold' : 'text-slate-300'}>{count}/{target}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* ASSIGNMENT MODAL FRAME */}
      {isModalOpen && selectedEmployee && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full border border-gray-200 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
            <div className="bg-gray-900 p-4 text-white font-bold flex flex-col">
              <span className="text-sm font-medium text-slate-400">Scheduling Shift Position:</span>
              <span className="text-base text-amber-400 font-black mt-0.5">{selectedEmployee.name} — {targetDateString}</span>
            </div>

            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Select Target Position</label>
                {selectedEmployee.role === "admin" ? (
                  <select value={shiftRole} onChange={(e) => setShiftRole(e.target.value)} className="w-full rounded-lg border border-amber-300 p-2.5 text-sm outline-none bg-amber-50/40 focus:border-amber-500 font-bold text-gray-800">
                    {companyActivePositions.map(pos => (
                      <option key={pos} value={pos} className="capitalize">{pos}</option>
                    ))}
                  </select>
                ) : selectedEmployee.role === "manager" ? (
                  <div className="w-full rounded-lg bg-amber-50/20 border border-amber-200 p-3 text-sm font-bold text-amber-900 capitalize flex items-center justify-between">
                    <span>{shiftRole}</span>
                    <span className="text-[10px] bg-amber-200 text-amber-700 px-2 py-0.5 rounded tracking-wider uppercase font-black">Manager Fixed</span>
                  </div>
                ) : Array.isArray(selectedEmployee.position) && selectedEmployee.position.length > 1 ? (
                  <select value={shiftRole} onChange={(e) => setShiftRole(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#005088] font-medium text-gray-800">
                    {selectedEmployee.position.map(pos => (
                      <option key={pos} value={pos.toLowerCase()} className="capitalize">{pos}</option>
                    ))}
                  </select>
                ) : (
                  <div className="w-full rounded-lg bg-gray-100 border border-gray-200 p-3 text-sm font-bold text-gray-700 capitalize flex items-center justify-between">
                    <span>{shiftRole}</span>
                    <span className="text-[10px] bg-gray-200 text-gray-500 px-2 py-0.5 rounded tracking-wider uppercase font-black">Profile Fixed</span>
                  </div>
                )}
              </div>

              {!isCustomTime ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider">Select Baseline Shift Pattern</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PRESET_SHIFTS.map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => handleSelectPreset(preset.time, preset.tier)}
                        className="p-3 text-left border border-gray-200 rounded-lg bg-slate-50 hover:bg-blue-50 hover:border-blue-300 transition-all"
                      >
                        <p className="font-bold text-sm text-gray-900">{preset.label}</p>
                        <p className="text-xs text-gray-400 mt-1 flex items-center gap-1"><Clock size={10} />{preset.time}</p>
                      </button>
                    ))}
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setIsCustomTime(true)} 
                    className="w-full py-2.5 mt-2 border border-dashed border-slate-300 text-slate-500 hover:text-[#005088] hover:border-[#005088] rounded-lg text-xs font-bold transition-all text-center"
                  >
                    + Create Custom Shift Range
                  </button>
                </div>
              ) : (
                <form onSubmit={handleCustomShiftSubmit} className="space-y-4 border-t border-gray-100 pt-4 animate-in slide-in-from-bottom-2 duration-150">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Start Time (In)</label>
                      <input type="text" placeholder="11:00 AM" required value={customStartTime} onChange={(e) => setCustomStartTime(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#005088]" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">End Time (Out)</label>
                      <input type="text" placeholder="4:00 PM" required value={customEndTime} onChange={(e) => setCustomEndTime(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#005088]" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Shift Tier</label>
                    <select value={customTier} onChange={(e) => setCustomTier(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2.5 text-sm outline-none focus:border-[#005088]">
                      <option value="Lunch">Lunch</option>
                      <option value="Dinner">Dinner</option>
                      <option value="Double">Double</option>
                    </select>
                  </div>
                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={() => setIsCustomTime(false)} className="text-xs font-bold text-gray-400 hover:text-gray-600 px-3">Back to Presets</button>
                    <button type="submit" className="bg-[#005088] text-white px-4 py-2 rounded-lg font-bold text-xs hover:bg-blue-800 shadow-sm transition-colors">Save Custom Shift</button>
                  </div>
                </form>
              )}

              <div className="pt-4 flex items-center justify-end border-t border-gray-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-bold text-gray-400 hover:text-gray-600 transition-colors">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}