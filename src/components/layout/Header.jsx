import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, Calendar, PercentCircle, Settings, ChevronDown, Plug, LogOut, User } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/seasonality", label: "Seasonality", icon: Calendar },
  { to: "/clearance", label: "Clearance", icon: PercentCircle },
  { to: "/integrations", label: "Integrations", icon: Plug }
];

export default function Header() {
  const { 
    selectedMarketplace, 
    setSelectedMarketplace, 
    selectedCategory, 
    setSelectedCategory,
    setSettingsOpen,
    marketplaces,
    categories
  } = useApp();

  const { user, signOut } = useAuth();

  return (
    <header id="header" className="sticky top-0 z-50 bg-dashboard-card border-b border-dashboard-border">
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amazon-orange to-orange-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="text-lg font-medium text-white leading-tight">Seller Analytics</h1>
              <p className="text-lg text-slate-400 leading-tight">Amazon EU Platform</p>
            </div>
          </div>

          <nav className="flex items-center gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => clsx(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-light transition-all duration-200",
                  isActive 
                    ? "bg-amazon-orange/20 text-amazon-orange" 
                    : "text-slate-400 hover:text-white hover:bg-dashboard-hover"
                )}
              >
                <Icon className="w-5 h-5" />
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="appearance-none bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2 pr-10 text-lg font-light text-white focus:outline-none focus:border-amazon-orange cursor-pointer"
            >
              <option value="all">All Markets</option>
              {marketplaces.map(mp => (
                <option key={mp.id} value={mp.id}>{mp.flag} {mp.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2 pr-10 text-lg font-light text-white focus:outline-none focus:border-amazon-orange cursor-pointer"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors"
          >
            <Settings className="w-5 h-5" />
          </button>

          {user && (
            <div className="flex items-center gap-2 pl-4 border-l border-dashboard-border">
              <div className="flex items-center gap-2 text-lg font-extralight text-slate-400">
                <User className="w-5 h-5" />
                <span>{user.email}</span>
              </div>
              <button
                onClick={signOut}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
