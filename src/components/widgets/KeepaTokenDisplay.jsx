import React, { useEffect, useState } from "react";
import { useKeepa } from "@/context/KeepaContext";

const KeepaTokenDisplay = () => {
  const { tokenBalance, lastSync, nextSync, fetchTokenBalance, forceRefresh, loading } = useKeepa();
  const [timeUntilSync, setTimeUntilSync] = useState("");

  // Calculate time until next midnight sync
  useEffect(() => {
    if (!nextSync) return;

    const updateCountdown = () => {
      const now = new Date();
      const diff = nextSync - now;

      if (diff <= 0) {
        setTimeUntilSync("Syncing soon...");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeUntilSync(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [nextSync]);

  const handleRefreshTokens = async () => {
    await fetchTokenBalance();
  };

  const formatDate = (date) => {
    if (!date) return "Never";
    return new Date(date).toLocaleString("ro-RO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-extralight text-gray-900">Keepa Tokens</h3>
        <button
          onClick={handleRefreshTokens}
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-lg font-extralight rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      <div className="space-y-4">
        {/* Token Balance */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-lg font-extralight text-gray-600 mb-1">Available Tokens</p>
          <p className="text-4xl font-extralight text-blue-600">
            {tokenBalance !== null ? tokenBalance.tokensLeft : "..."}
          </p>
          {tokenBalance && (
            <p className="text-lg font-extralight text-gray-500 mt-2">
              Refill: {tokenBalance.refillRate} tokens/min
            </p>
          )}
        </div>

        {/* Last Sync */}
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="text-lg font-extralight text-gray-600 mb-1">Last Data Refresh</p>
          <p className="text-xl font-extralight text-gray-900">{formatDate(lastSync)}</p>
        </div>

        {/* Next Sync Countdown */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4 shadow-sm">
          <p className="text-lg font-extralight text-white mb-1">Next Auto-Refresh</p>
          <p className="text-2xl font-extralight text-white">🌙 Midnight (00:00)</p>
          <p className="text-lg font-extralight text-indigo-100 mt-2">in {timeUntilSync}</p>
        </div>

        {/* Info */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-lg font-extralight text-amber-800">
            💡 <strong className="font-normal">Token Saving Mode:</strong> Date refresh automat doar la miezul nopții pentru economisire tokeni
          </p>
        </div>
      </div>
    </div>
  );
};

export default KeepaTokenDisplay;
