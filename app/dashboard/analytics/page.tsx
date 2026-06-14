"use client";

import { useState, useEffect } from "react";
import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, onSnapshot } from "firebase/firestore";
import { DollarSign, TrendingUp, ShoppingCart, PieChart, Loader2 } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";

// --- FIREBASE CLIENT CONFIGURATION CONFIG ---
// Replace these parameters with your exact Firebase Console Project Settings values
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "lineup-72c1e.firebaseapp.com",
  projectId: "lineup-72c1e",
  storageBucket: "lineup-72c1e.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Prevent multi-instance hot reload initialization crashes
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getFirestore(app);

type Tab = 'Gross Sales' | 'Net Profit' | 'Wage Spending' | 'Food Sales';

interface LiveMetrics {
  grossSalesToday: number;
  netSalesToday: number;
  taxCollectedToday: number;
  totalClosedTickets: number;
  activeHeadcount: number;
  liveHourlyLaborRate: number;
  businessDate: string;
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Gross Sales');
  const [metrics, setMetrics] = useState<LiveMetrics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // hardcoded routing ID parameter - adjust to match your active restaurant slug node
  const restaurantId = "golden-lion"; 

  useEffect(() => {
    // 1. Establish pointer path reference map to your real-time aggregate document
    const metricsDocRef = doc(db, "restaurants", restaurantId, "dashboard", "live_metrics");

    // 2. Open a persistent streaming websocket listener pipe straight to the cloud
    const unsubscribe = onSnapshot(metricsDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const rawData = snapshot.data();
        setMetrics({
          grossSalesToday: Number(rawData.grossSalesToday || 0),
          netSalesToday: Number(rawData.netSalesToday || 0),
          taxCollectedToday: Number(rawData.taxCollectedToday || 0),
          totalClosedTickets: Number(rawData.totalClosedTickets || 0),
          activeHeadcount: Number(rawData.activeHeadcount || 0),
          liveHourlyLaborRate: Number(rawData.liveHourlyLaborRate || 0),
          businessDate: rawData.businessDate || "Today",
        });
      }
      setLoading(false);
    }, (error) => {
      console.error("Firestore stream routing breakdown:", error);
      setLoading(false);
    });

    // 3. Auto-tear down websocket thread context on component exit
    return () => unsubscribe();
  }, [restaurantId]);

  const tabs: { name: Tab; icon: any }[] = [
    { name: 'Gross Sales', icon: TrendingUp },
    { name: 'Net Profit', icon: PieChart },
    { name: 'Wage Spending', icon: DollarSign },
    { name: 'Food Sales', icon: ShoppingCart },
  ];

  // --- COMPILER WORKFLOW: DYNAMIC GRAPH VALUE DATA DESK ---
  const generateChartData = () => {
    if (!metrics) return [];

    // Generates a mock operational trend view matrix utilizing your live numbers
    switch (activeTab) {
      case 'Gross Sales':
        return [
          { time: '11:00 AM', sales: metrics.grossSalesToday * 0.15 },
          { time: '1:00 PM', sales: metrics.grossSalesToday * 0.40 },
          { time: '4:00 PM', sales: metrics.grossSalesToday * 0.55 },
          { time: '7:00 PM', sales: metrics.grossSalesToday * 0.85 },
          { time: 'LIVE NOW', sales: metrics.grossSalesToday },
        ];
      case 'Wage Spending':
        // Project labor out across an 8-hour shift curve
        return [
          { hour: 'HR 1', cost: metrics.liveHourlyLaborRate },
          { hour: 'HR 2', cost: metrics.liveHourlyLaborRate * 2 },
          { hour: 'HR 4', cost: metrics.liveHourlyLaborRate * 4 },
          { hour: 'RUNNING TOTAL', cost: metrics.liveHourlyLaborRate * 6 },
        ];
      case 'Net Profit':
        // Compare revenue streams vs operational overhead spend bounds
        return [
          { name: 'Overhead Costs', amount: metrics.grossSalesToday * 0.35 },
          { name: 'Tax Pool', amount: metrics.taxCollectedToday },
          { name: 'True Net Margins', amount: metrics.netSalesToday - (metrics.liveHourlyLaborRate * 5) },
        ];
      case 'Food Sales':
        return [
          { range: 'Avg Ticket', volume: metrics.totalClosedTickets > 0 ? metrics.netSalesToday / metrics.totalClosedTickets : 0 },
          { range: 'Tickets Sold', volume: metrics.totalClosedTickets },
        ];
      default:
        return [];
    }
  };

  if (loading) {
    return (
      <div className="min-h-[600px] w-full flex flex-col items-center justify-center text-gray-500 gap-3">
        <Loader2 className="animate-spin text-[#005088]" size={40} />
        <p className="font-medium animate-pulse">Syncing with Live Restaurant POS Data Feeds...</p>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-7xl mx-auto w-full min-h-screen bg-gray-50">
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Analytics Dashboard</h1>
          <p className="text-gray-500 mt-1">Real-time business performance metrics and labor cost analytics.</p>
        </div>
        <div className="bg-white px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-bold text-gray-400">
          STATUS: <span className="text-emerald-500 animate-pulse">● LIVE STREAM ACTIVE</span>
        </div>
      </div>

      {/* --- TOP ROW SUMMARY HIGHLIGHT CARD OVERVIEW --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Gross Revenue</p>
          <p className="text-2xl font-black text-gray-900 mt-2">${metrics?.grossSalesToday.toFixed(2) || "0.00"}</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Closed Checks</p>
          <p className="text-2xl font-black text-gray-900 mt-2">{metrics?.totalClosedTickets || 0} Tickets</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Active Floor Labor</p>
          <p className="text-2xl font-black text-amber-500 mt-2">{metrics?.activeHeadcount || 0} Clocked In</p>
        </div>
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Labor Burn Run Rate</p>
          <p className="text-2xl font-black text-rose-500 mt-2">${metrics?.liveHourlyLaborRate.toFixed(2)}/hr</p>
        </div>
      </div>

      {/* Navigation Filter Tabs UI Row */}
      <div className="flex gap-2 mb-8 border-b border-gray-200 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isSelected = activeTab === tab.name;
          return (
            <button 
              key={tab.name} 
              onClick={() => setActiveTab(tab.name)}
              className={`flex items-center gap-2 px-6 py-4 font-bold border-b-2 transition-all whitespace-nowrap text-sm ${
                isSelected 
                  ? "border-[#005088] text-[#005088] bg-blue-50/50" 
                  : "border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-100/50"
              }`}
            >
              <Icon size={18} />
              {tab.name}
            </button>
          );
        })}
      </div>

      {/* --- LIVE GRAPH COMPONENT CONTAINER PORTAL --- */}
      <div className="bg-white p-8 rounded-xl border border-gray-200 shadow-sm min-h-[520px]">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">{activeTab} Summary View</h2>
          <p className="text-xs text-gray-400 mt-0.5">Tracking for current operational business date: {metrics?.businessDate}</p>
        </div>
        
        <div className="w-full h-96 mt-4">
          <ResponsiveContainer width="100%" height="100%">
            {activeTab === 'Gross Sales' || activeTab === 'Wage Spending' ? (
              // Area graph presentation logic for rolling asset trends
              <AreaChart data={generateChartData()} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={activeTab === 'Gross Sales' ? "#11CAA0" : "#ef4444"} stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={activeTab === 'Gross Sales' ? "#11CAA0" : "#ef4444"} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={activeTab === 'Gross Sales' ? "time" : "hour"} stroke="#9ca3af" style={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: 12 }} tickFormatter={(val) => `$${val}`} />
                <Tooltip formatter={(value) => [`$${Number(value).toFixed(2)}`, activeTab]} />
                <Area type="monotone" dataKey={activeTab === 'Gross Sales' ? "sales" : "cost"} stroke={activeTab === 'Gross Sales' ? "#11CAA0" : "#ef4444"} strokeWidth={3} fillOpacity={1} fill="url(#chartGradient)" />
              </AreaChart>
            ) : (
              // Discrete bar chart metrics layout presentation blocks
              <BarChart data={generateChartData()} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey={activeTab === 'Net Profit' ? "name" : "range"} stroke="#9ca3af" style={{ fontSize: 12 }} />
                <YAxis stroke="#9ca3af" style={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => [typeof value === 'number' && activeTab === 'Net Profit' ? `$${value.toFixed(2)}` : value]} />
                <Bar dataKey={activeTab === 'Net Profit' ? "amount" : "volume"} fill="#005088" radius={[6, 6, 0, 0]} maxBarSize={60} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}