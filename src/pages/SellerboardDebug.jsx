import React, { useState, useEffect } from "react";
import { RefreshCw, Database, AlertCircle, CheckCircle2, FileText } from "lucide-react";

export default function SellerboardDebug() {
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    sales_30d: null,
    sales_monthly: null,
    cogs: null,
    stock: null
  });
  const [errors, setErrors] = useState({});
  const [activeTab, setActiveTab] = useState("sales_30d");

  const reportTypes = [
    { id: "sales_30d", label: "Sales 30D", icon: Database },
    { id: "sales_monthly", label: "Sales Monthly", icon: Database },
    { id: "cogs", label: "COGS", icon: Database },
    { id: "stock", label: "Stock", icon: Database }
  ];

  const fetchReport = async (reportType) => {
    setLoading(true);
    setErrors(prev => ({ ...prev, [reportType]: null }));

    try {
      const response = await fetch(`/api/sellerboard?reportType=${reportType}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText.substring(0, 200)}`);
      }

      const csvText = await response.text();
      setResults(prev => ({
        ...prev,
        [reportType]: {
          raw: csvText,
          lines: csvText.split("\n").length,
          size: new Blob([csvText]).size,
          preview: csvText.split("\n").slice(0, 10).join("\n"),
          timestamp: new Date().toISOString()
        }
      }));
    } catch (error) {
      console.error(`Error fetching ${reportType}:`, error);
      setErrors(prev => ({
        ...prev,
        [reportType]: error.message
      }));
    } finally {
      setLoading(false);
    }
  };

  const fetchAllReports = async () => {
    for (const report of reportTypes) {
      await fetchReport(report.id);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  };

  useEffect(() => {
    fetchAllReports();
  }, []);

  const currentResult = results[activeTab];
  const currentError = errors[activeTab];

  return (
    <div id="sellerboard-debug-page" className="min-h-screen bg-dashboard-bg p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-medium text-white">Sellerboard Debug Console</h1>
            <p className="text-lg font-extralight text-slate-400 mt-2">
              Testează conexiunea directă cu Sellerboard și vezi datele RAW
            </p>
          </div>
          <button
            onClick={fetchAllReports}
            disabled={loading}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-amazon-orange text-white hover:bg-orange-600 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
            Refresh All
          </button>
        </div>

        <div className="grid grid-cols-4 gap-4">
          {reportTypes.map(report => {
            const Icon = report.icon;
            const hasData = results[report.id];
            const hasError = errors[report.id];

            return (
              <button
                key={report.id}
                onClick={() => setActiveTab(report.id)}
                className={`p-4 rounded-lg border transition-all ${
                  activeTab === report.id
                    ? "bg-dashboard-card border-amazon-orange"
                    : "bg-dashboard-bg border-dashboard-border hover:border-slate-600"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5 text-amazon-orange" />
                  <div className="text-left flex-1">
                    <div className="text-lg font-medium text-white">{report.label}</div>
                    <div className="text-lg font-extralight text-slate-400 mt-1">
                      {hasError ? (
                        <span className="text-red-400 flex items-center gap-1">
                          <AlertCircle className="w-4 h-4" />
                          Error
                        </span>
                      ) : hasData ? (
                        <span className="text-green-400 flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" />
                          {hasData.lines} lines
                        </span>
                      ) : (
                        <span className="text-slate-500">Loading...</span>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        <div className="bg-dashboard-card border border-dashboard-border rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6 text-amazon-orange" />
              <div>
                <h2 className="text-xl font-medium text-white">
                  {reportTypes.find(r => r.id === activeTab)?.label} - Raw Data
                </h2>
                {currentResult && (
                  <p className="text-lg font-extralight text-slate-400 mt-1">
                    {currentResult.lines} lines • {(currentResult.size / 1024).toFixed(2)} KB • 
                    Updated {new Date(currentResult.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            {!currentError && currentResult && (
              <button
                onClick={() => fetchReport(activeTab)}
                disabled={loading}
                className="px-4 py-2 rounded-lg bg-dashboard-hover text-white hover:bg-slate-700 transition-colors text-lg font-extralight disabled:opacity-50"
              >
                Refresh
              </button>
            )}
          </div>

          {currentError ? (
            <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />
                <div>
                  <h3 className="text-lg font-medium text-red-400 mb-2">Error Loading Data</h3>
                  <pre className="text-lg font-extralight text-red-300 whitespace-pre-wrap font-mono">
                    {currentError}
                  </pre>
                </div>
              </div>
            </div>
          ) : currentResult ? (
            <div className="space-y-4">
              <div className="bg-dashboard-bg border border-dashboard-border rounded-lg p-4 overflow-x-auto">
                <div className="text-lg font-extralight text-slate-400 mb-2">CSV Preview (first 10 lines):</div>
                <pre className="text-lg font-extralight text-green-400 font-mono whitespace-pre overflow-x-auto">
                  {currentResult.preview}
                </pre>
              </div>

              <details className="bg-dashboard-bg border border-dashboard-border rounded-lg">
                <summary className="px-4 py-3 cursor-pointer text-lg font-medium text-white hover:bg-dashboard-hover transition-colors">
                  View Full CSV ({currentResult.lines} lines)
                </summary>
                <div className="p-4 border-t border-dashboard-border overflow-x-auto">
                  <pre className="text-lg font-extralight text-slate-300 font-mono whitespace-pre overflow-x-auto max-h-96 overflow-y-auto">
                    {currentResult.raw}
                  </pre>
                </div>
              </details>

              <div className="grid grid-cols-3 gap-4">
                <div className="bg-dashboard-bg border border-dashboard-border rounded-lg p-4">
                  <div className="text-lg font-extralight text-slate-400">Total Lines</div>
                  <div className="text-2xl font-medium text-white mt-1">{currentResult.lines}</div>
                </div>
                <div className="bg-dashboard-bg border border-dashboard-border rounded-lg p-4">
                  <div className="text-lg font-extralight text-slate-400">File Size</div>
                  <div className="text-2xl font-medium text-white mt-1">
                    {(currentResult.size / 1024).toFixed(2)} KB
                  </div>
                </div>
                <div className="bg-dashboard-bg border border-dashboard-border rounded-lg p-4">
                  <div className="text-lg font-extralight text-slate-400">Data Rows</div>
                  <div className="text-2xl font-medium text-white mt-1">
                    {currentResult.lines - 1}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-8 h-8 text-amazon-orange animate-spin" />
            </div>
          )}
        </div>

        <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-400 mb-3">🔍 Debug Information</h3>
          <ul className="space-y-2 text-lg font-extralight text-slate-300">
            <li>• <strong>Proxy URL:</strong> /api/sellerboard</li>
            <li>• <strong>Request Format:</strong> /api/sellerboard?reportType=sales_30d</li>
            <li>• <strong>Expected Response:</strong> CSV text/plain</li>
            <li>• <strong>Environment:</strong> URLs sunt citite din .env (VITE_SELLERBOARD_*_URL)</li>
            <li>• <strong>Stock URL:</strong> {import.meta.env.VITE_SELLERBOARD_STOCK_URL ? "Configured ✅" : "NOT configured ❌"}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
