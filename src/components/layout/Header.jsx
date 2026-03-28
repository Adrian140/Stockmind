import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Package, Calendar, PercentCircle, Settings, ChevronDown, Plug, LogOut } from "lucide-react";
import { useApp } from "../../context/AppContext";
import { useAuth } from "../../context/AuthContext";
import clsx from "clsx";

const navItems = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/seasonality", label: "Seasonality", icon: Calendar },
  { to: "/clearance", label: "Clearance", icon: PercentCircle }
];

export default function Header() {
  const [settingsMenuOpen, setSettingsMenuOpen] = React.useState(false);
  const settingsMenuRef = React.useRef(null);
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

  React.useEffect(() => {
    function handleClickOutside(event) {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(event.target)) {
        setSettingsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header id="header" className="sticky top-0 z-50 bg-dashboard-card border-b border-dashboard-border">
      <div className="max-w-[1920px] mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-8 min-w-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-amazon-orange to-orange-600 flex items-center justify-center">
              <span className="text-xl font-bold text-white">A</span>
            </div>
            <div>
              <h1 className="text-lg font-medium text-white leading-tight">Seller Analytics</h1>
            </div>
          </div>

          <nav className="flex items-center gap-1 min-w-0 flex-wrap">
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

        <div className="flex items-center gap-3 min-w-0 shrink-0">
          <div className="relative min-w-0">
            <select
              value={selectedMarketplace}
              onChange={(e) => setSelectedMarketplace(e.target.value)}
              className="appearance-none bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2 pr-10 text-lg font-light text-white focus:outline-none focus:border-amazon-orange cursor-pointer max-w-[220px]"
            >
              <option value="all">All Markets</option>
              {marketplaces.map(mp => (
                <option key={mp.id} value={mp.id}>{mp.flag} {mp.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div className="relative min-w-0">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="appearance-none bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-2 pr-10 text-lg font-light text-white focus:outline-none focus:border-amazon-orange cursor-pointer max-w-[220px]"
            >
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
          </div>

          <div ref={settingsMenuRef} className="relative shrink-0">
            <button
              onClick={() => setSettingsMenuOpen((open) => !open)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors"
              title="Settings"
            >
              <Settings className="w-5 h-5" />
            </button>

            {settingsMenuOpen && (
              <div className="absolute right-0 top-full mt-2 w-52 rounded-lg border border-dashboard-border bg-dashboard-card shadow-xl overflow-hidden">
                <button
                  onClick={() => {
                    setSettingsOpen(true);
                    setSettingsMenuOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm text-slate-300 hover:bg-dashboard-hover hover:text-white transition-colors"
                >
                  <Settings className="w-4 h-4" />
                  Application Settings
                </button>

                <NavLink
                  to="/integrations"
                  onClick={() => setSettingsMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-dashboard-hover hover:text-white transition-colors"
                >
                  <Plug className="w-4 h-4" />
                  Integrations
                </NavLink>
              </div>
            )}
          </div>

          {user && (
            <div className="pl-3 border-l border-dashboard-border shrink-0">
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
