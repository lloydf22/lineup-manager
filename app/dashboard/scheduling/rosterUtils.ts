import { Timestamp } from "firebase/firestore";

export interface Shift {
  id: string;
  serverName: string;
  role: string; 
  displayDayString: string; 
  displayTimeRange: string; 
  tier: string;             
}

export interface Employee {
  id: string;
  name: string;
  position?: string | string[]; 
  role: string;                 
  wageRate: number;
  availability?: { [key: string]: boolean }; // Maps to availability image_fee941.png
}

export interface TimeOffRequest {
  id: string;
  uid: string;
  name: string;
  startDate: Date;
  endDate: Date;
  status: string; // "Approved", "Denied", or "Pending"
}

export interface PositionDemand {
  [dayName: string]: {
    [tierName: string]: {
      [positionName: string]: number;
    };
  };
}

export const PRESET_SHIFTS = [
  { label: "Open", time: "10:00 AM - 4:00 PM", tier: "Lunch" },
  { label: "Lunch", time: "11:00 AM - 4:00 PM", tier: "Lunch" },
  { label: "Dinner", time: "4:00 PM - 10:00 PM", tier: "Dinner" },
  { label: "Close", time: "4:00 PM - 11:00 PM", tier: "Dinner" },
];

export const formatToRosterDayString = (date: Date): string => {
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'short', 
    day: 'numeric' 
  });
};

export const calculateHoursFromString = (timeRangeStr: string): number => {
  try {
    const parts = timeRangeStr.split(" - ");
    if (parts.length !== 2) return 0;

    const parseTime = (tStr: string) => {
      const [time, modifier] = tStr.split(" ");
      let [hours, minutes] = time.split(":").map(Number);
      if (modifier === "PM" && hours < 12) hours += 12;
      if (modifier === "AM" && hours === 12) hours = 0;
      return hours + (minutes / 60);
    };

    const start = parseTime(parts[0]);
    const end = parseTime(parts[1]);
    let diff = end - start;
    if (diff < 0) diff += 24; 
    return diff;
  } catch {
    return 0; 
  }
};

export const calculateWeeklyLaborCost = (shifts: Shift[], employees: Employee[]): number => {
  let totalCost = 0;
  shifts.forEach((shift) => {
    const employee = employees.find(e => e.name.toLowerCase() === shift.serverName.toLowerCase());
    const wageRate = employee?.wageRate ?? 15.00;
    const hours = calculateHoursFromString(shift.displayTimeRange);
    totalCost += hours * wageRate;
  });
  return totalCost;
};

export const getUniqueCompanyPositions = (employees: Employee[]): string[] => {
  const positionsSet = new Set<string>();
  positionsSet.add("server"); 
  positionsSet.add("bartender");
  positionsSet.add("host");
  
  employees.forEach(emp => {
    if (!emp.position) return;
    if (Array.isArray(emp.position)) {
      emp.position.forEach(p => positionsSet.add(p.toLowerCase()));
    } else {
      positionsSet.add(emp.position.toLowerCase());
    }
  });
  return Array.from(positionsSet);
};

/**
 * Checks if a specific employee is blocked from working on a given calendar day
 * based on weekly recurring availability rules or approved specific time off requests.
 */
export const isEmployeeUnavailable = (employee: Employee, targetDate: Date, timeOffRequests: TimeOffRequest[]): { unavailable: boolean; reason: string } => {
  // 1. Evaluate general recurring weekly availability map
  if (employee.availability) {
    const dayOfWeekStr = targetDate.toLocaleDateString('en-US', { weekday: 'long' }); // e.g., "Friday"
    if (employee.availability[dayOfWeekStr] === false) {
      return { unavailable: true, reason: "Set Roster Availability" };
    }
  }

  // 2. Evaluate approved specific date range requests
  // Normalize date comparison targets to plain day boundaries at midnight
  const targetTime = new Date(targetDate).setHours(0, 0, 0, 0);

  const parsedMatchRequest = timeOffRequests.find(req => {
    if (req.uid !== employee.id || req.status !== "Approved") return false;
    const start = new Date(req.startDate).setHours(0, 0, 0, 0);
    const end = new Date(req.endDate).setHours(23, 59, 59, 999);
    return targetTime >= start && targetTime <= end;
  });

  if (parsedMatchRequest) {
    return { unavailable: true, reason: "Approved Time-Off Request" };
  }

  return { unavailable: false, reason: "" };
};

const getLastName = (fullName: string): string => {
  const parts = fullName.trim().split(/\s+/);
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : fullName.toLowerCase();
};

export const sortEmployeesByPositionAndLastName = (employees: Employee[]): Employee[] => {
  return [...employees].sort((a, b) => {
    const posA = Array.isArray(a.position) ? a.position[0] : (a.position || "floor staff");
    const posB = Array.isArray(b.position) ? b.position[0] : (b.position || "floor staff");

    const posCompare = posA.toLowerCase().localeCompare(posB.toLowerCase());
    if (posCompare !== 0) return posCompare;

    return getLastName(a.name).localeCompare(getLastName(b.name));
  });
};