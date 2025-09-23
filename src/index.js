// src/index.js
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { HashRouter } from "react-router-dom"; // <-- tambah
import "./index.css";
import "./api/client"; // setup axios interceptors

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <HashRouter> {/* <-- ganti pakai HashRouter */}
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </HashRouter>
  </React.StrictMode>
);
