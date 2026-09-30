import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  CONT_ACT_MIN_KEY, readMinimizedPref, writeMinimizedPref, initialContActMinimized, isMobileViewport,
} from "./continuousActivityUiPrefs";

function mockMatchMedia(matches: boolean): void {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches,
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    onchange: null,
    dispatchEvent: () => false,
  }));
}

describe("continuousActivityUiPrefs", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("readMinimizedPref retorna null sem preferência salva", () => {
    expect(readMinimizedPref()).toBeNull();
  });

  it("write/read faz round-trip", () => {
    writeMinimizedPref(true);
    expect(localStorage.getItem(CONT_ACT_MIN_KEY)).toBe("1");
    expect(readMinimizedPref()).toBe(true);
    writeMinimizedPref(false);
    expect(readMinimizedPref()).toBe(false);
  });

  it("isMobileViewport reflete o matchMedia", () => {
    mockMatchMedia(true);
    expect(isMobileViewport()).toBe(true);
    mockMatchMedia(false);
    expect(isMobileViewport()).toBe(false);
  });

  it("initial: sem preferência, minimiza no mobile e expande no desktop", () => {
    mockMatchMedia(true);
    expect(initialContActMinimized()).toBe(true); // mobile → compacto
    mockMatchMedia(false);
    expect(initialContActMinimized()).toBe(false); // desktop → expandido
  });

  it("initial: preferência salva vence o viewport", () => {
    mockMatchMedia(true); // mobile, que por padrão minimizaria
    writeMinimizedPref(false); // usuário escolheu expandido
    expect(initialContActMinimized()).toBe(false);

    mockMatchMedia(false); // desktop, que por padrão expandiria
    writeMinimizedPref(true); // usuário escolheu compacto
    expect(initialContActMinimized()).toBe(true);
  });
});
