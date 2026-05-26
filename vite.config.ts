import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@core": resolve(__dirname, "src/core"),
			"@ui": resolve(__dirname, "src/ui"),
			"@state": resolve(__dirname, "src/state"),
			"@data": resolve(__dirname, "src/data"),
			"@game": resolve(__dirname, "src/game"),
			"@assets": resolve(__dirname, "src/assets"),
			"@narrative": resolve(__dirname, "src/narrative"),
			"@audio": resolve(__dirname, "src/audio"),
		},
	},
	test: {
		environment: "jsdom",
		globals: true,
		setupFiles: ["./src/test-setup.ts"],
		coverage: {
			provider: "v8",
			include: ["src/core/**"],
			thresholds: {
				lines: 90,
				functions: 90,
				branches: 85,
			},
		},
	},
});
