import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { BrowserRouter, useNavigate } from "react-router-dom";
import { onUnauthorized } from "./api/client";
import "./index.css";
import "./api/client";

// Komponen kecil untuk daftar handler unauthorized dan navigate SPA
function AuthBridge() {
  const navigate = useNavigate();

  React.useEffect(() => {
    const unsub = onUnauthorized(async () => {
      // bersihkan semua cache & state query
      queryClient.clear();
      await queryClient.refetchQueries({ type: "active" });
      // arahkan ke login tanpa reload
      navigate("/", { replace: true });
    });
    return unsub;
  }, [navigate]);

  return null;
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthBridge />
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
