"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../lib/firebase";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const router = useRouter();
  
  // NEW: Grab the permissionError from the AuthContext alongside the user status
  const { user, loading: authLoading, permissionError } = useAuth();

  // If Firebase says the user is already logged in, route them straight to the dashboard
  useEffect(() => {
    if (!authLoading && user) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); // Prevents the page from refreshing on submit
    setError("");
    setIsLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Once successful, the useEffect above will catch the new user state and route them!
    } catch (err) {
      setError("Invalid email or password. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Show a blank screen while checking auth state so there's no flicker
  if (authLoading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center" />;
  }

  // If a user is logged in, return null while the redirect happens
  if (user) return null;

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-[#005088]">Lineup</h1>
          <p className="text-gray-500 mt-2">Manager Portal</p>
        </div>

        {/* NEW: Displays either local Firebase auth errors OR the role permission errors */}
        {(error || permissionError) && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg mb-6 text-sm text-center font-medium">
            {error || permissionError}
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005088] focus:border-transparent outline-none transition-all"
              placeholder="manager@lineup.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#005088] focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-[#005088] hover:bg-[#003f6b] text-white font-bold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center"
          >
            {isLoading ? (
              <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              "Sign In"
            )}
          </button>
        </form>
      </div>
    </main>
  );
}