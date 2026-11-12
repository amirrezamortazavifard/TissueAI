import "./styles/index.css";
import "./styles/anatomy.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ErrorBoundary } from "./components/ErrorBoundary";
import App from "./App";
import { initializeServiceHubStore } from "./hooks/useServiceHub";
import { defaultServiceHub } from "./lib/serviceHub";

initializeServiceHubStore(defaultServiceHub);

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
