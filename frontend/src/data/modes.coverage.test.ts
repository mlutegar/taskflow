import { describe, it, expect } from "vitest";
import { MODES, CATEGORY_BY_ID, HELPER_GROUPS } from "./modes";
import { MUSIC_VARIANTS } from "./musicVariants";
import { getHelper } from "../components/daily-focus/helpers";
import { SESSION_MAP } from "../components/ModeSession";
import { canonicalModeId } from "../lib/modeAliases";

interface ModeLike {
  id: string;
  session?: string;
  preset?: { variant?: string };
}

const byId = new Map((MODES as ModeLike[]).map((m) => [m.id, m]));

describe("catálogo de modos — integridade", () => {
  it("não tem ids duplicados", () => {
    const ids = (MODES as ModeLike[]).map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("todos os ids dos HELPER_GROUPS existem no catálogo (pega typos)", () => {
    // Roots de sessão que não são cards do catálogo mas são agrupados no picker do DailyFocus.
    const NON_CATALOG_ROOTS = new Set([
      "tiktok", "splite", "lazyfal", "modo_aleatorio", "tiktok_salvos", "instagram_salvos",
    ]);
    for (const group of HELPER_GROUPS) {
      for (const id of group.ids) {
        if (NON_CATALOG_ROOTS.has(id)) continue;
        expect(byId.has(id), `id "${id}" (grupo ${group.label}) não existe em MODES`).toBe(true);
      }
    }
  });
});

describe("Music Mode — cards achatados", () => {
  it("o card único legado 'music' não existe mais", () => {
    expect(byId.has("music")).toBe(false);
  });

  it("o alias legado 'music' aponta para 'music_hundred'", () => {
    expect(canonicalModeId("music")).toBe("music_hundred");
  });

  it("cada variante de música é um card próprio, com helper e sessão", () => {
    for (const v of MUSIC_VARIANTS) {
      const mode = byId.get(v.id) as ModeLike | undefined;
      expect(mode, `card ausente: ${v.id}`).toBeTruthy();
      expect(mode!.session).toBe("music");
      expect(mode!.preset?.variant).toBe(v.variant);

      // Categoria
      expect((CATEGORY_BY_ID as Record<string, string>)[v.id] ?? (mode as { category?: string }).category)
        .toBe("Música");

      // Helper do Daily Focus resolve para a variante certa
      const helper = getHelper(v.id);
      expect(helper, `helper ausente: ${v.id}`).toBeTruthy();
      expect((helper!.defaultState as { variant?: string }).variant).toBe(v.variant);

      // Sessão resolve para um componente registrado
      expect(SESSION_MAP[mode!.session as string]).toBeTruthy();
    }
  });
});
