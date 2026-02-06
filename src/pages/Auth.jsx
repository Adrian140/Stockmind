import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import LoginForm from "../components/auth/LoginForm";
import SignupForm from "../components/auth/SignupForm";

export default function Auth() {
  const [mode, setMode] = useState("login");
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-dashboard-bg flex items-center justify-center">
        <div className="text-white text-xl font-extralight">Loading...</div>
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-dashboard-bg flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br from-amazon-orange to-orange-600 mb-4">
            <span className="text-3xl font-bold text-white">A</span>
          </div>
          <h1 className="text-3xl font-light text-white mb-2">Amazon Seller Analytics</h1>
          <p className="text-lg font-extralight text-slate-400">
            {mode === "login" ? "Welcome back!" : "Create your account"}
          </p>
        </div>

        <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-8">
          {mode === "login" ? (
            <LoginForm onToggleMode={() => setMode("signup")} />
          ) : (
            <SignupForm onToggleMode={() => setMode("login")} />
          )}
        </div>
      </div>
    </div>
  );
}
