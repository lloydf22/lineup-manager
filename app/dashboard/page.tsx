"use client";

import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Users, UserPlus, CalendarPlus, TrendingUp, DollarSign, Receipt, AlertTriangle } from "lucide-react";
import { collection, getDocs } from "firebase/firestore";
import { db } from "../../lib/firebase";
import Link from "next/link";

export default function DashboardOverview() {
  const { user } = useAuth();
  
  const [clockedInCount, setClockedInCount] = useState(0);
  const [currentHourlyCost, setCurrentHourlyCost] = useState(0);
  const [liveGrossSales] = useState(1245.50);
  const [recentOrders] = useState([
    { id: "TKT-089", total: 45.00, items: 3, time: "Just now" },
    { id: "TKT-088", total: 112.50, items: 6, time: "5 min ago" },
    { id: "TKT-087", total: 24.00, items: 2, time: "12 min ago" },
  ]);
  const [lowInventory] = useState([
    { id: "INV-1", name: "Sirloin Steak (8oz)", stock: 3 },
    { id: "INV-2", name: "Avocado", stock: 0 },
    { id: "INV-3", name: "Draft IPA Keg", stock: 1 },
  ]);

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Only attempt to fetch if the user is loaded and has a restaurantId
    if (!user?.restaurantId) return;

    const fetchDashboardData = async () => {
      setIsLoading(true);
      try {
        const usersRef = collection(db, "restaurants", user.restaurantId, "users");
        const usersSnap = await getDocs(usersRef);
        
        let activeStaff = 0;
        let activeCost = 0;

        usersSnap.forEach((doc) => {
          const data = doc.data();
          // Ensure we are checking the boolean value
          if (data.isClockedIn === true) {
            activeStaff += 1;
            activeCost += Number(data.wageRate) || 0;
          }
        });

        setClockedInCount(activeStaff);
        setCurrentHourlyCost(activeCost);
      } catch (error) {
        console.error("Error fetching dashboard data:", error);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchDashboardData();
  }, [user?.restaurantId]);

  const laborPercentage = liveGrossSales > 0 ? ((currentHourlyCost * 8) / liveGrossSales * 100).toFixed(1) : "0.0";
  const firstName = user?.name?.split(" ")[0] || "Manager";

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Command Center</h1>
          <p className="text-gray-500 mt-2 text-lg">Welcome back, {firstName}. Here is your live venue data.</p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-full font-medium text-sm border border-green-200">
          <span className="relative flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
          </span>
          POS System Online
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <div className="bg-white p-6 rounded-xl border border-gray-400 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold text-gray-700">Live Gross Sales</div>
            <DollarSign size={20} className="text-green-600" />
          </div>
          <div className="text-3xl font-bold text-gray-900">{`$${liveGrossSales.toFixed(2)}`}</div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-gray-400 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <div className="text-sm font-bold text-gray-700">Current Labor %</div>
            <TrendingUp size={20} className={Number(laborPercentage) > 20 ? "text-red-600" : "text-[#11CAA0]"} />
          </div>
          <div className="text-3xl font-bold text-gray-900">{isLoading ? "..." : `${laborPercentage}%`}</div>
        </div>

        <div className="bg-white p-6 rounded-xl border-l-4 border-l-blue-600 border border-gray-400 shadow-sm">
          <div className="text-sm font-bold text-gray-700 mb-1">Clocked In Now</div>
          <div className="text-3xl font-bold text-blue-700">{isLoading ? "..." : clockedInCount} <span className="text-sm font-normal text-gray-600">staff</span></div>
        </div>

        <div className="bg-white p-6 rounded-xl border-l-4 border-l-[#11CAA0] border border-gray-400 shadow-sm">
          <div className="text-sm font-bold text-gray-700 mb-1">Hourly Labor Cost</div>
          <div className="text-3xl font-bold text-[#11CAA0]">{isLoading ? "..." : `$${currentHourlyCost.toFixed(2)}/hr`}</div>
        </div>
      </div>

      {/* Remainder of your UI components remain the same... */}
    </div>
  );
}