import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import App from "./App.tsx";
import { ErrorBoundary } from "@/components/state/ErrorBoundary";
import "./index.css";

const convex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL as string);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ConvexProvider client={convex}>
        {/* BASE_URL is "/" locally and on Render, "/GrokMarketPulse/" on GitHub Pages. */}
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
      </ConvexProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
