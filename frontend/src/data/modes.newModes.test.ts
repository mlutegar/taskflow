import { describe, it, expect } from "vitest";
import { MODES, CATEGORY_BY_ID, HELPER_GROUPS } from "./modes";
import { getHelper } from "../components/daily-focus/helpers";
import { SESSION_MAP } from "../components/ModeSession";
import CafeRitualSession from "../components/sessions/CafeRitualSession";
import MusicSession from "../components/sessions/MusicSession";
import SpliteSession from "../components/sessions/SpliteSession";

interface ModeLike { id: string; session?: string; preset?: { variant?: string }; category?: string; type?: string }
const byId = new Map((MODES as ModeLike[]).map((m) => [m.id, m]));

// Mesma regra de ModeSession: `mode.session || mode.id`
const resolve = (id: string) => SESSION_MAP[byId.get(id)!.session || id];

const NEW_MODES = [
  { id: "cafe_com_leite", category: "Ritual",  component: CafeRitualSession, variant: "leite" },
  { id: "music_liked",    category: "Música",  component: MusicSession,      variant: "liked" },
  { id: "music_dj",       category: "Música",  component: MusicSession,      variant: "dj" },
];

describe("novos modos (prompt 01) — sem fallback SpliteSession", () => {
  for (const n of NEW_MODES) {
    describe(n.id, () => {
      it("existe no catálogo com categoria e preset corretos", () => {
        const m = byId.get(n.id);
        expect(m).toBeTruthy();
        expect(CATEGORY_BY_ID[n.id as keyof typeof CATEGORY_BY_ID]).toBe(n.category);
        expect(m!.category).toBe(n.category);
        expect(m!.preset?.variant).toBe(n.variant);
      });

      it("resolve no SESSION_MAP para a sessão própria (não SpliteSession)", () => {
        expect(resolve(n.id)).toBe(n.component);
        expect(resolve(n.id)).not.toBe(SpliteSession);
      });

      it("está em HELPER_GROUPS e getHelper() não devolve null", () => {
        expect(HELPER_GROUPS.some((g) => g.ids.includes(n.id))).toBe(true);
        const helper = getHelper(n.id);
        expect(helper).not.toBeNull();
        expect((helper!.defaultState as { variant?: string }).variant).toBe(n.variant);
      });
    });
  }

  it("cafe_com_leite também resolve pela chave do próprio id", () => {
    expect(SESSION_MAP.cafe_com_leite).toBe(CafeRitualSession);
  });
});
