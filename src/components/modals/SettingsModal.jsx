import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Save, Database, Sliders } from 'lucide-react';
import { useApp } from '../../context/AppContext';

export default function SettingsModal() {
  const { 
    settings, 
    setSettings, 
    settingsOpen, 
    setSettingsOpen,
    useSellerboardData,
    setUseSellerboardData 
  } = useApp();
  const [localSettings, setLocalSettings] = React.useState(settings);
  const [localUseSellerboard, setLocalUseSellerboard] = React.useState(useSellerboardData);
  const [activeTab, setActiveTab] = React.useState('data-source');

  React.useEffect(() => {
    setLocalSettings(settings);
    setLocalUseSellerboard(useSellerboardData);
  }, [settings, useSellerboardData]);

  const handleSave = () => {
    setSettings(localSettings);
    setUseSellerboardData(localUseSellerboard);
    setSettingsOpen(false);
  };

  const tabs = [
    { id: 'data-source', label: 'Data Source', icon: Database },
    { id: 'thresholds', label: 'Thresholds', icon: Sliders }
  ];

  return (
    <AnimatePresence>
      {settingsOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-40"
            onClick={() => setSettingsOpen(false)}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
            className="fixed top-16 right-4 md:right-6 mt-2 z-50 w-[calc(100%-2rem)] md:w-[520px] bg-dashboard-card rounded-xl border border-dashboard-border shadow-2xl max-h-[80vh] flex flex-col"
          >
            <div className="flex items-center justify-between p-6 border-b border-dashboard-border flex-shrink-0">
              <h2 className="text-xl font-medium text-white">Application Settings</h2>
              <button
                onClick={() => setSettingsOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs Navigation */}
            <div className="flex border-b border-dashboard-border flex-shrink-0">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-6 py-4 text-lg font-light transition-colors relative ${
                      activeTab === tab.id
                        ? 'text-amazon-orange'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute bottom-0 left-0 right-0 h-0.5 bg-amazon-orange"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Tab Content - Scrollable */}
            <div className="p-6 overflow-y-auto flex-1">
              <AnimatePresence mode="wait">
                {activeTab === 'data-source' && (
                  <motion.div
                    key="data-source"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="bg-dashboard-bg rounded-lg border border-dashboard-border p-6">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-xl font-light text-white mb-2">
                            Use Sellerboard Data
                          </h3>
                          <p className="text-lg font-extralight text-slate-400">
                            When enabled, the application will use real data from Sellerboard API. 
                            When disabled, mock data will be used for demonstration purposes.
                          </p>
                        </div>
                        <button
                          onClick={() => setLocalUseSellerboard(!localUseSellerboard)}
                          className={`relative ml-4 flex-shrink-0 w-16 h-8 rounded-full transition-colors ${
                            localUseSellerboard ? 'bg-amazon-orange' : 'bg-slate-600'
                          }`}
                        >
                          <motion.div
                            initial={false}
                            animate={{
                              x: localUseSellerboard ? 32 : 0
                            }}
                            transition={{ type: 'spring', bounce: 0.3, duration: 0.4 }}
                            className="absolute top-1 left-1 w-6 h-6 bg-white rounded-full shadow-md"
                          />
                        </button>
                      </div>
                      <div className="mt-4 pt-4 border-t border-dashboard-border">
                        <div className="text-lg font-extralight text-slate-300">
                          Current Status: 
                          <span className={`ml-2 font-light ${
                            localUseSellerboard ? 'text-green-400' : 'text-yellow-400'
                          }`}>
                            {localUseSellerboard ? '✓ Using Sellerboard API' : '⚠ Using Mock Data'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {activeTab === 'thresholds' && (
                  <motion.div
                    key="thresholds"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="space-y-6"
                  >
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-lg font-light text-slate-300 mb-2">
                          Minimum ROI (%)
                        </label>
                        <input
                          type="number"
                          value={localSettings.minRoi}
                          onChange={(e) => setLocalSettings(s => ({ ...s, minRoi: Number(e.target.value) }))}
                          className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-3 text-lg font-light text-white focus:outline-none focus:border-amazon-orange transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-lg font-light text-slate-300 mb-2">
                          Minimum Units (30 days)
                        </label>
                        <input
                          type="number"
                          value={localSettings.minUnits}
                          onChange={(e) => setLocalSettings(s => ({ ...s, minUnits: Number(e.target.value) }))}
                          className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-3 text-lg font-light text-white focus:outline-none focus:border-amazon-orange transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-lg font-light text-slate-300 mb-2">
                          Minimum Profit/Unit (€)
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          value={localSettings.minProfitUnit}
                          onChange={(e) => setLocalSettings(s => ({ ...s, minProfitUnit: Number(e.target.value) }))}
                          className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-3 text-lg font-light text-white focus:outline-none focus:border-amazon-orange transition-colors"
                        />
                      </div>

                      <div>
                        <label className="block text-lg font-light text-slate-300 mb-2">
                          Max Volatility Threshold
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          value={localSettings.volatilityThreshold}
                          onChange={(e) => setLocalSettings(s => ({ ...s, volatilityThreshold: Number(e.target.value) }))}
                          className="w-full bg-dashboard-bg border border-dashboard-border rounded-lg px-4 py-3 text-lg font-light text-white focus:outline-none focus:border-amazon-orange transition-colors"
                        />
                      </div>
                    </div>

                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                      <p className="text-lg font-extralight text-blue-300">
                        💡 These thresholds are used to filter buy recommendations. 
                        Products must meet ALL criteria to appear in recommendations.
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-dashboard-border flex-shrink-0">
              <button
                onClick={() => setSettingsOpen(false)}
                className="px-4 py-2 rounded-lg text-lg font-light text-slate-400 hover:text-white hover:bg-dashboard-hover transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-lg font-light bg-amazon-orange text-white hover:bg-orange-600 transition-colors"
              >
                <Save className="w-4 h-4" />
                Save Settings
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
