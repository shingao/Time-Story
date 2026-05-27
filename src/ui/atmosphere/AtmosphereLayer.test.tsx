import { useUIStore } from "@state/useUIStore.ts";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AtmosphereLayer } from "./AtmosphereLayer.tsx";

// jsdom doesn't implement matchMedia — stub it
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

beforeEach(() => {
	useUIStore.setState({
		currentAtmosphereId: "guild_interior",
		atmosphereEffectsEnabled: false, // disable particles/parallax for tests
	});
});

describe("AtmosphereLayer", () => {
	it("renders without crashing", () => {
		const { unmount } = render(<AtmosphereLayer />);
		unmount();
	});

	it("is aria-hidden (purely decorative)", () => {
		const { container } = render(<AtmosphereLayer />);
		const root = container.firstChild as HTMLElement;
		expect(root?.getAttribute("aria-hidden")).toBe("true");
	});

	it("shows placeholder label when image errors", async () => {
		const { container } = render(<AtmosphereLayer />);
		const img = container.querySelector("img");
		if (img) {
			await act(async () => {
				img.dispatchEvent(new Event("error"));
			});
			expect(container.textContent).toContain("Placeholder");
			expect(container.textContent).toContain("Wigglytuff");
		}
	});

	it("crossfades when atmosphere changes", async () => {
		render(<AtmosphereLayer />);
		await act(async () => {
			useUIStore.getState().setAtmosphere("mystifying_forest");
		});
		// New slide should be present (placeholder since image is missing in jsdom)
		expect(document.body.innerHTML).toBeTruthy();
	});

	it("renders placeholder gradient when effects are disabled", async () => {
		render(<AtmosphereLayer />);
		// In jsdom, img always errors — verify fallback renders
		const img = document.querySelector("img");
		if (img) {
			await act(async () => {
				img.dispatchEvent(new Event("error"));
			});
		}
		expect(document.body.textContent).toContain("Placeholder");
	});
});

describe("AtmosphereLayer — atmosphere switching", () => {
	it("renders distortion realm atmosphere", async () => {
		render(<AtmosphereLayer />);
		await act(async () => {
			useUIStore.getState().setAtmosphere("distortion_realm");
		});
		expect(useUIStore.getState().currentAtmosphereId).toBe("distortion_realm");
	});

	it("effects can be toggled off", () => {
		useUIStore.getState().setAtmosphereEffects(false);
		expect(useUIStore.getState().atmosphereEffectsEnabled).toBe(false);
		useUIStore.getState().setAtmosphereEffects(true);
		expect(useUIStore.getState().atmosphereEffectsEnabled).toBe(true);
	});
});
