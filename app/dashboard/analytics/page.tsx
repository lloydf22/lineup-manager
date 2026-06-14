"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, ShoppingCart, PieChart } from "lucide-react";

type Tab = 'Wage Spending' | 'Gross Sales' | 'Net Profit' | 'Food Sales';

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('Gross Sales');

  const tabs: { name: Tab, icon: any }[] = [
    { name: 'Gross Sales', icon: TrendingUp },
    { name: 'Net Profit', icon: PieChart },
    { name: 'Wage Spending', icon: DollarSign },
    { name: 'Food Sales', icon: ShoppingCart },
  ];

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
        <p className="text-gray-500 mt-2">Business performance metrics and cost analysis.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-gray-300 overflow-x-auto">
        {tabs.map((tab) => (
          <button 
            key={tab.name} 
            onClick={() => setActiveTab(tab.name)}
            className={`flex items-center gap-2 px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.name 
                ? "border-[#005088] text-[#005088]" 
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon size={20} />
            {tab.name}
          </button>
        ))}
      </div>

      {/* Analytics Container */}
      <div className="bg-white p-8 rounded-xl border border-gray-400 shadow-sm min-h-[500px]">
        <h2 className="text-xl font-bold text-gray-900 mb-6">{activeTab} Overview</h2>
        
        {/* Placeholder for Data Visualization */}
        <div className="w-full h-80 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400">
          <PieChart size={48} className="mb-4 opacity-50" />
          <p className="font-medium">Waiting for data feed from POS / Firebase...</p>
        </div>
      </div>
    </div>
  );
}