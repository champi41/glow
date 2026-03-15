import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {AuthProvider} from "./context/AuthContext.jsx";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import App from "./App.jsx";

if (window.location.pathname.startsWith("/admin")) {
  registerSW({ immediate: true });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
    },
  },
});

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>
);
