import { registerSW } from "virtual:pwa-register";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

registerSW({
	immediate: true,
});

const rootElement = document.getElementById("root");

if (!rootElement) {
	throw new Error("Root element not found.");
}

createRoot(rootElement).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
