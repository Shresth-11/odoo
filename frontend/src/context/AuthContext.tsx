import React, { createContext, useContext, useState, useEffect } from "react";

export interface User {
  id: number;
  name: string;
  email: string;
  role: "Admin" | "AssetManager" | "DepartmentHead" | "Employee";
  status: "Active" | "Inactive" | "Suspended";
  department_id: number | null;
  department_name?: string | null;
}

interface AuthContextType {
  token: string | null;
  user: User | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  apiFetch: (url: string, options?: RequestInit) => Promise<any>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(localStorage.getItem("af_token"));
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedUser = localStorage.getItem("af_user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        localStorage.removeItem("af_user");
      }
    }
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem("af_token", newToken);
    localStorage.setItem("af_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = () => {
    localStorage.removeItem("af_token");
    localStorage.removeItem("af_user");
    setToken(null);
    setUser(null);
  };

  const updateUser = (newUser: User) => {
    localStorage.setItem("af_user", JSON.stringify(newUser));
    setUser(newUser);
  };

  // Helper function to call the backend API with the Authorization header
  const apiFetch = async (endpoint: string, options: RequestInit = {}) => {
    const headers = new Headers(options.headers || {});
    
    // Add auth token if available
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    
    // Add JSON content type if body is present and not form data
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";
    const response = await fetch(`${API_BASE_URL}/api${endpoint}`, {
      ...options,
      headers,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Something went wrong");
    }

    return data;
  };

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider value={{ token, user, isAuthenticated, login, logout, updateUser, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
