// src/context/AuthContext.jsx

import { createContext, useContext, useEffect, useState } from "react";
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase.js";

// ─── Contexto ────────────────────────────────────────────────
const AuthContext = createContext(null);

// ─── Provider ────────────────────────────────────────────────
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // Firebase Auth user
  const [profile, setProfile] = useState(null); // users/{uid}
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [errorAuth, setErrorAuth] = useState(null);

  // Escuchar cambios de sesión
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const profileDoc = await getDoc(doc(db, "users", firebaseUser.uid));

          if (profileDoc.exists()) {
            setProfile({ uid: firebaseUser.uid, ...profileDoc.data() });
          } else {
            // Usuario Auth sin documento en users/
            console.warn("Usuario sin perfil en Firestore:", firebaseUser.uid);
            setProfile(null);
          }

          setUser(firebaseUser);
        } catch (err) {
          console.error("Error al cargar perfil:", err);
          setProfile(null);
          setUser(firebaseUser);
        }
      } else {
        setUser(null);
        setProfile(null);
      }

      setLoadingAuth(false);
    });

    return unsubscribe;
  }, []);

  // ── Login ───────────────────────────────────────────────────
  async function login(email, password) {
    setErrorAuth(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged se encarga del resto
    } catch (err) {
      const message = getAuthErrorMessage(err.code);
      setErrorAuth(message);
      throw new Error(message);
    }
  }

  // ── Logout ──────────────────────────────────────────────────
  async function logout() {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    }
  }

  // ── Helpers de rol ──────────────────────────────────────────
  const isOwner = profile?.role === "owner";
  const isManager = profile?.role === "manager";
  const canManage = isOwner || isManager; // acceso a servicios y horario

  const value = {
    user,
    profile,
    tenantId: profile?.tenantId || null,
    professionalId: profile?.professionalId || null,
    role: profile?.role || null,
    isOwner,
    isManager,
    canManage,
    loadingAuth,
    errorAuth,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ─── Hook ────────────────────────────────────────────────────
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

// ─── Mensajes de error en español ───────────────────────────
function getAuthErrorMessage(code) {
  switch (code) {
    case "auth/invalid-email":
      return "El correo no es válido.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Correo o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos. Espera unos minutos e intenta nuevamente.";
    case "auth/network-request-failed":
      return "Sin conexión. Verifica tu internet e intenta nuevamente.";
    default:
      return "Ocurrió un error al iniciar sesión. Intenta nuevamente.";
  }
}
