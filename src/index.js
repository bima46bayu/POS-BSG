import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./queryClient";
import { BrowserRouter } from "react-router-dom";
import "./index.css";

// Unauthorized handling lives in App/AppShell (installUnauthorizedRedirect), so
// there is no AuthBridge here anymore. Two subscribers used to race: one sent
// the user to /unauthorized, the other to /. Only one destination now.
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
);
