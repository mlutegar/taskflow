import MusicHelper, { DEFAULT_STATE as musicDefault } from "./MusicHelper";
import SingHelper, { DEFAULT_STATE as singDefault } from "./SingHelper";
import TikTokHelper, { DEFAULT_STATE as tiktokDefault } from "./TikTokHelper";
import SpliteHelper, { DEFAULT_STATE as spliteDefault } from "./SpliteHelper";
import LazyFalconHelper, { DEFAULT_STATE as lazyfalDefault } from "./LazyFalconHelper";
import MomentumHelper, { DEFAULT_STATE as momentumDefault } from "./MomentumHelper";
import EspressoHelper, { DEFAULT_STATE as espressoDefault } from "./EspressoHelper";
import RPGHelper, { DEFAULT_STATE as rpgDefault } from "./RPGHelper";
import CafeRitualHelper, { DEFAULT_STATE as cafeDefault } from "./CafeRitualHelper";
import TabHopHelper, { DEFAULT_STATE as tabhopDefault } from "./TabHopHelper";
import CustomModeHelper, { DEFAULT_STATE as customDefault } from "./CustomModeHelper";

/**
 * Registry of all available helper panels for Daily Focus.
 * Each entry maps a mode ID (or prefix) to its component and default state.
 */
export const HELPER_REGISTRY = {
  music: { Component: MusicHelper, defaultState: musicDefault },
  sing_one: { Component: SingHelper, defaultState: { ...singDefault, variant: "one" } },
  sing_ten: { Component: SingHelper, defaultState: { ...singDefault, variant: "ten" } },
  tiktok: { Component: TikTokHelper, defaultState: tiktokDefault },
  splite: { Component: SpliteHelper, defaultState: spliteDefault },
  lazyfal: { Component: LazyFalconHelper, defaultState: lazyfalDefault },
  momentum: { Component: MomentumHelper, defaultState: momentumDefault },
  espresso: { Component: EspressoHelper, defaultState: espressoDefault },
  rpg: { Component: RPGHelper, defaultState: rpgDefault },
  caferitual: { Component: CafeRitualHelper, defaultState: cafeDefault },
  tabhop: { Component: TabHopHelper, defaultState: tabhopDefault },
};

/**
 * Get helper entry for a given modeId.
 * Handles splite_* variants and custom_* modes.
 */
export function getHelper(modeId) {
  if (!modeId) return null;
  if (HELPER_REGISTRY[modeId]) return HELPER_REGISTRY[modeId];

  // Splite variants (splite_beber_agua, etc.)
  if (modeId.startsWith("splite_")) {
    return HELPER_REGISTRY.splite;
  }

  // Custom modes
  if (modeId.startsWith("custom_")) {
    return { Component: CustomModeHelper, defaultState: customDefault };
  }

  return null;
}
