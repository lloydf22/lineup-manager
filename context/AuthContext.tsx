"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

export interface ManagerProfile extends User {
  role: string;
  restaurantId: string;
  name: string;
}

interface AuthContextType {
  user: ManagerProfile | null;
  loading: boolean;
  permissionError: string | null;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  permissionError: null,
});

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<ManagerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      // Reset state for new auth event
      setPermissionError(null);

      if (!currentUser) {
        setUser(null);
        setLoading(false);
        return;
      }

      try {
        // 1. Fetch all restaurants
        const restsSnapshot = await getDocs(collection(db, "restaurants"));

        // 2. Map through to create an array of promises for parallel lookup
        const checkPromises = restsSnapshot.docs.map(async (restDoc) => {
          const userDocRef = doc(db, "restaurants", restDoc.id, "users", currentUser.uid);
          const snap = await getDoc(userDocRef);
          return snap.exists() ? { data: snap.data(), restId: restDoc.id } : null;
        });

        // 3. Resolve all lookups concurrently
        const results = await Promise.all(checkPromises);
        const foundMatch = results.find((r) => r !== null);

        if (foundMatch) {
          const { data, restId } = foundMatch;
          const role = (data.role || "").toLowerCase();
          const allowedRoles = ["admin", "manager", "foh manager", "boh manager"];

          if (allowedRoles.includes(role)) {
            setUser({
              ...currentUser,
              role: role,
              restaurantId: restId,
              name: data.name || "User",
            });
          } else {
            await signOut(auth);
            setPermissionError(`Access Denied: Your role (${role}) is not authorized.`);
          }
        } else {
          await signOut(auth);
          setPermissionError("Error: Profile data not found in database.");
        }
      } catch (err) {
        console.error("AuthContext Error:", err);
        await signOut(auth);
        setPermissionError("A network error occurred while verifying permissions.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, permissionError }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);