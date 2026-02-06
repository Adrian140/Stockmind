import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import { SellerboardProvider } from "./context/SellerboardContext";
import { AppProvider } from "./context/AppContext";
import { KeepaProvider } from "./context/KeepaContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <SellerboardProvider>
          <AppProvider>
            <KeepaProvider>
              <App />
            </KeepaProvider>
          </AppProvider>
        </SellerboardProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
