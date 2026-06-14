"use client";

import { useAuth } from "../../context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { 
  LogOut, 
  LayoutDashboard, 
  Users, 
  Calendar, 
  BarChart3, 
  Package 
} from "lucide-react";
import { auth } from "../../lib/firebase";
import Link from "next/link";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Protect the dashboard: if they aren't logged in, kick them to the login screen
  useEffect(() => {
    if (!loading && !user) {
      router.push("/");
    }
  }, [user, loading, router]);

  if (loading || !user) return <div className="min-h-screen bg-gray-50" />;

  const handleLogout = () => {
    auth.signOut();
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-[#005088]">Lineup</h1>
        </div>
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {/* Overview */}
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 bg-[#005088] text-white rounded-lg font-medium">
            <LayoutDashboard size={20} />
            <span>Overview</span>
          </Link>

          {/* Inventory */}
          <Link href="/dashboard/inventory" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">
            <Package size={20} />
            <span>Inventory</span>
          </Link>

          {/* Staff Roster */}
          <Link href="/dashboard/roster" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">
            <Users size={20} />
            <span>Staff Roster</span>
          </Link>

          {/* Schedule */}
          <Link href="/dashboard/scheduling" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">
            <Calendar size={20} />
            <span>Schedule</span>
          </Link>

          {/* Analytics */}
          <Link href="/dashboard/analytics" className="flex items-center gap-3 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors font-medium">
            <BarChart3 size={20} />
            <span>Analytics</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-gray-200">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
          >
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto">
        {children}
      </main>
    </div>
  );
}