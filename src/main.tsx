import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";

const removeLegacyServiceWorkers = async (): Promise<void> => {
	if (!("serviceWorker" in navigator)) {
		return;
	}

	const registrations = await navigator.serviceWorker.getRegistrations();
	await Promise.all(
		registrations.map((registration) => registration.unregister()),
	);

	if ("caches" in window) {
		const cacheNames = await window.caches.keys();
		await Promise.all(
			cacheNames.map((cacheName) => window.caches.delete(cacheName)),
		);
	}
};

window.addEventListener("load", () => {
	void removeLegacyServiceWorkers();
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
