import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: "autoUpdate",
			manifest: {
				name: "Spring Rate",
				short_name: "Spring Rate",
				start_url: "/",
				display: "standalone",
				theme_color: "#0f172a",
				background_color: "#eef2f8",
				icons: [
					{
						src: "/vite.svg",
						sizes: "any",
						type: "image/svg+xml",
					},
				],
			},
			workbox: {
				navigateFallback: "/index.html",
			},
		}),
	],
	test: {
		environment: "jsdom",
		globals: false,
		setupFiles: ["./src/test/setup.ts"],
		css: true,
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
		},
	},
});
