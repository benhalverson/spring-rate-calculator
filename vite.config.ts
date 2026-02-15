import { cloudflare } from "@cloudflare/vite-plugin";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import { defineConfig } from "vitest/config";

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		...(process.env.VITEST ? [] : [cloudflare()]),
		react(),
		VitePWA({
			registerType: "autoUpdate",
			includeAssets: [
				"icons/icon-192.png",
				"icons/icon-512.png",
				"icons/maskable-192.png",
				"icons/maskable-512.png",
			],
			manifest: {
				name: "Spring Rate",
				short_name: "Spring Rate",
				start_url: "/",
				display: "standalone",
				theme_color: "#0f172a",
				background_color: "#eef2f8",
				icons: [
					{
						src: "/icons/icon-192.png",
						sizes: "192x192",
						type: "image/png",
					},
					{
						src: "/icons/icon-512.png",
						sizes: "512x512",
						type: "image/png",
					},
					{
						src: "/icons/maskable-192.png",
						sizes: "192x192",
						type: "image/png",
						purpose: "maskable",
					},
					{
						src: "/icons/maskable-512.png",
						sizes: "512x512",
						type: "image/png",
						purpose: "maskable",
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
