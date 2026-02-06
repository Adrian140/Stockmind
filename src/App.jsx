import React, { useEffect } from "react";
import { Routes, Route, useLocation } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/layout/Layout";
import Dashboard from "./pages/Dashboard";
import Products from "./pages/Products";
import Seasonality from "./pages/Seasonality";
import Clearance from "./pages/Clearance";
import Integrations from "./pages/Integrations";
import Auth from "./pages/Auth";
import SellerboardDebug from "./pages/SellerboardDebug";

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#1e293b",
            color: "#fff",
            borderRadius: "8px",
            border: "1px solid #334155",
            fontSize: "18px",
            fontWeight: "200"
          }
        }}
      />
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/debug" element={<SellerboardDebug />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="products" element={<Products />} />
          <Route path="seasonality" element={<Seasonality />} />
          <Route path="clearance" element={<Clearance />} />
          <Route path="integrations" element={<Integrations />} />
        </Route>
      </Routes>
    </>
  );
}
