import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { ToastProvider, useToast } from "./Toast";

type Show = ReturnType<typeof useToast>["showToast"];
let show: Show;
function Grab() {
  show = useToast().showToast;
  return null;
}
function setup() {
  render(<ToastProvider><Grab /></ToastProvider>);
}

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("Toast — API de showToast", () => {
  it("mantém o default: tipo info e some em 3000ms", () => {
    vi.useFakeTimers();
    setup();
    act(() => show("olá"));
    expect(screen.getByText("olá")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2999); });
    expect(screen.queryByText("olá")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(2); });
    expect(screen.queryByText("olá")).not.toBeInTheDocument();
  });

  it("aceita options como 2º argumento: { duration } e { type }", () => {
    vi.useFakeTimers();
    setup();
    act(() => show("curto", { duration: 500 }));
    act(() => show("falha", { type: "error", duration: 5000 }));
    act(() => { vi.advanceTimersByTime(600); });
    expect(screen.queryByText("curto")).not.toBeInTheDocument();
    expect(screen.getByText("falha")).toBeInTheDocument();
    act(() => { vi.advanceTimersByTime(4500); });
    expect(screen.queryByText("falha")).not.toBeInTheDocument();
  });

  it("assinatura antiga (msg, type, { durationMs }) continua valendo e durationMs vence duration", () => {
    vi.useFakeTimers();
    setup();
    act(() => show("antigo", "success", { durationMs: 1000, duration: 9000 }));
    act(() => { vi.advanceTimersByTime(1100); });
    expect(screen.queryByText("antigo")).not.toBeInTheDocument();
  });

  it("suporta o tipo 'warning'", () => {
    setup();
    act(() => show("atenção", "warning"));
    expect(screen.getByText("atenção")).toBeInTheDocument();
  });
});
