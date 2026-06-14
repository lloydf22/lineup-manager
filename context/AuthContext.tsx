"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { onAuthStateChanged, User, signOut } from "firebase/auth";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";

// 1. We create a custom profile type that includes your database fields
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
      setPermissionError(null); // Reset errors on new login attempt

      if (currentUser) {
        try {
          // 2. Search Firestore to find which restaurant this user belongs to
          const restsSnapshot = await getDocs(collection(db, "restaurants"));
          let userData = null;
          let restId = "";

          for (const restDoc of restsSnapshot.docs) {
            const userDocRef = doc(db, "restaurants", restDoc.id, "users", currentUser.uid);
            const userDocSnap = await getDoc(userDocRef);

            if (userDocSnap.exists()) {
              userData = userDocSnap.data();
              restId = restDoc.id;
              break;
            }
          }

          // 3. Check their Role!
          if (userData) {
            const role = (userData.role || "").toLowerCase();
            // Define exactly who is allowed in the building
            const allowedRoles = ["admin", "manager", "foh manager", "boh manager"];

            if (allowedRoles.includes(role)) {
              // They are allowed! Save all their data so the dashboard can use it
              setUser({
                ...currentUser,
                role: role,
                restaurantId: restId,
                name: userData.name,
              });
            } else {
              // They are a real user, but just a team_member. Kick them out!
              await signOut(auth);
              setPermissionError(`Access Denied: Your role (${role}) does not have portal access.`);
              setUser(null);
            }
          } else {
             await signOut(auth);
             setPermissionError("Error: Profile data not found in database.");
             setUser(null);
          }
        } catch (err) {
          console.error("Error fetching user profile:", err);
          await signOut(auth);
          setPermissionError("A network error occurred while verifying permissions.");
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
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