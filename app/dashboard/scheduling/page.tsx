"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Wand2, Save, Plus, Trash2, Printer } from "lucide-react";

type Position = 'Server' | 'Busser' | 'Bar' | 'Food Run' | 'Kitchen' | 'Dish';

export default function SchedulePage() {
  const [activeTab, setActiveTab] = useState<Position>('Server');
  const [shifts, setShifts] = useState([
    { id: 1, label: 'Lunch', time: '11:00 AM - 4:00 PM' },
    { id: 2, label: 'Dinner', time: '4:00 PM - 10:00 PM' },
  ]);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - d.getDay() + i + 1);
    return d;
  });

  const addShiftRow = () => setShifts([...shifts, { id: Date.now(), label: 'New Shift', time: '00:00 - 00:00' }]);
  const removeShiftRow = (id: number) => setShifts(shifts.filter(s => s.id !== id));

  return (
    <div className="p-8 max-w-7xl mx-auto w-full">
      <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Schedule Manager</h1>
          <p className="text-gray-500 mt-2">Manage coverage, monitor labor costs, and prevent conflicts.</p>
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="flex items-center gap-2 bg-white border border-gray-400 text-gray-900 px-4 py-2 rounded-lg font-bold hover:bg-gray-50">
            <Printer size={18} /> Print
          </button>
          <button className="flex items-center gap-2 bg-white border border-gray-400 text-gray-900 px-4 py-2 rounded-lg font-bold hover:bg-gray-50">
            <Save size={18} /> Save Template
          </button>
          <button className="flex items-center gap-2 bg-[#11CAA0] text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-500">
            <Wand2 size={18} /> Autofill Week
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6 border-b border-gray-300 overflow-x-auto">
        {['Server', 'Busser', 'Bar', 'Food Run', 'Kitchen', 'Dish'].map((pos) => (
          <button key={pos} onClick={() => setActiveTab(pos as Position)}
            className={`px-6 py-3 font-bold border-b-2 transition-colors whitespace-nowrap ${activeTab === pos ? "border-[#005088] text-[#005088]" : "border-transparent text-gray-500"}`}>
            {pos}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-400 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse min-w-[1000px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-400 text-gray-900">
                <th className="p-4 text-left font-bold border-r border-gray-300 w-64">Shift Details</th>
                {days.map((d, i) => (
                  <th key={i} className="p-4 text-center font-bold border-r border-gray-300 last:border-0">
                    {d.toLocaleDateString('en-US', { weekday: 'short' })}
                    <div className="text-sm font-normal text-gray-600">{d.getDate()}</div>
                  </th>
                ))}
                <th className="p-4"></th>
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift) => (
                <tr key={shift.id} className="border-b border-gray-200">
                  <td className="p-3 border-r border-gray-300">
                    <input type="text" defaultValue={shift.label} className="w-full font-bold border border-gray-400 rounded p-1 text-gray-900 mb-1" />
                    <input type="text" defaultValue={shift.time} className="w-full text-xs border border-gray-400 rounded p-1 text-gray-600" />
                  </td>
                  {days.map((_, i) => (
                    <td key={i} className="p-2 border-r border-gray-300 last:border-0 h-24 min-w-[140px]">
                      <div className="flex flex-col gap-2 items-center justify-center h-full">
                        <div className="flex items-center gap-2">
                          <label className="text-[10px] uppercase font-bold text-gray-500">REQ</label>
                          <input type="number" min="0" defaultValue="0" className="w-12 text-center border border-gray-400 rounded p-1 font-bold text-gray-900" />
                        </div>
                        <button className="w-full h-8 flex items-center justify-center bg-[#005088] text-white rounded font-bold text-xs hover:bg-[#003f6b] transition-colors shadow-sm">
                          <Plus size={14} className="mr-1" /> ASSIGN
                        </button>
                      </div>
                    </td>
                  ))}
                  <td className="p-4"><button onClick={() => removeShiftRow(shift.id)} className="text-red-500"><Trash2 size={18}/></button></td>
                </tr>
              ))}
              
              {/* NEW: Live Labor Cost Indicator Row */}
              <tr className="bg-gray-100 font-bold border-t-2 border-gray-400 text-gray-900">
                <td className="p-4 border-r border-gray-300">Projected Labor Cost</td>
                {days.map((_, i) => (
                  <td key={i} className="p-4 text-center border-r border-gray-300 text-[#005088]">
                    $0.00
                  </td>
                ))}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-gray-400 bg-gray-50 flex justify-between">
          <button onClick={addShiftRow} className="flex items-center gap-2 text-[#005088] font-bold hover:underline">
            <Plus size={18} /> Add Custom Shift Row
          </button>
          <div className="text-sm text-gray-500 font-medium">
            Note: Cells highlighted in <span className="text-red-600 font-bold">RED</span> indicate staff unavailability or OT conflicts.
          </div>
        </div>
      </div>
    </div>
  );
}