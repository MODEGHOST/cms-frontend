import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./app/App";
import "./styles.css";

// Vite BASE_URL ends with "/"; React Router basename must not.
const routerBasename = import.meta.env.BASE_URL.replace(/\/$/, "") || undefined;

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter basename={routerBasename}>
      <App />
    </BrowserRouter>
  </React.StrictMode>,
);
