import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { UserPlus, Mail, Lock, Eye, EyeOff } from "lucide-react";

export default function SignupForm({ onToggleMode }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      return;
    }
    setLoading(true);
    await signUp(email, password);
    setLoading(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-lg font-extralight text-slate-300 mb-2">Email Address</label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg pl-12 pr-4 py-3 text-lg font-extralight text-white focus:outline-none focus:border-amazon-orange"
            placeholder="you@example.com"
          />
        </div>
      </div>

      <div>
        <label className="block text-lg font-extralight text-slate-300 mb-2">Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type={showPassword ? "text" : "password"}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg pl-12 pr-12 py-3 text-lg font-extralight text-white focus:outline-none focus:border-amazon-orange"
            placeholder="••••••••"
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-lg font-extralight text-slate-300 mb-2">Confirm Password</label>
        <div className="relative">
          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type={showPassword ? "text" : "password"}
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg pl-12 pr-12 py-3 text-lg font-extralight text-white focus:outline-none focus:border-amazon-orange"
            placeholder="••••••••"
            minLength={6}
          />
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full bg-amazon-orange hover:bg-orange-600 disabled:bg-slate-700 text-white font-light text-lg py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
      >
        {loading ? (
          <span className="font-extralight">Creating account...</span>
        ) : (
          <>
            <UserPlus className="w-5 h-5" />
            <span className="font-extralight">Create Account</span>
          </>
        )}
      </button>

      <p className="text-center text-lg font-extralight text-slate-400">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onToggleMode}
          className="text-amazon-orange hover:text-orange-600 font-light"
        >
          Sign In
        </button>
      </p>
    </form>
  );
}
