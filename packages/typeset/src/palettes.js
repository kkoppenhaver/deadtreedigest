// Seasonal cover palettes (issue #12: National Park poster series). The
// close date picks the palette; the locale picks the scene; the spine and
// back cover never change — that's what keeps twelve issues on a shelf
// reading as a matched set. Summer is the founding palette: its tokens are
// the exact hexes the original cover shipped with, so Issue № 1 remains the
// canonical summer mountain.
//
// Token roles (every scene draws from these):
//   sky0/1/2            sky gradient, top -> horizon
//   sun, sunGlow        the disc and its halo tint
//   birds               small accent linework in the sky
//   far/farLit          most distant land layer (haziest, nearest sky value)
//   mid/midLit/midShade middle land layer
//   near/nearLit/nearShade  nearest big land layer
//   band                dark silhouette band (treeline, skyline, reeds)
//   ground0/ground1     foreground field, light then deep
//   path                the winding trail
//   tree0d/0l 1d/1l 2d/2l  the hero pine's three tiers, dark/lit facets
//
// The stump, saplings, and trunks keep their fixed browns and greens in
// every season — they are the brand motif, not scenery.

export const SEASONS = {
  summer: {
    sky0: "#f2ddaa", sky1: "#e8c579", sky2: "#dcaa55",
    sun: "#c65a2e", sunGlow: "#bf4e24",
    birds: "#8a5a33",
    far: "#d3bd85", farLit: "#dcc794",
    mid: "#a3ad7c", midLit: "#b1ba8a", midShade: "#95a06f",
    near: "#5d7a55", nearLit: "#6a8961", nearShade: "#516d4b",
    band: "#31543f",
    ground0: "#c9a94f", ground1: "#b8923e", path: "#dcc17a",
    tree0d: "#1f4d38", tree0l: "#2b6248",
    tree1d: "#193f2e", tree1l: "#26573f",
    tree2d: "#14352a", tree2l: "#1f4d38",
  },
  fall: {
    sky0: "#f2d9ae", sky1: "#e3b877", sky2: "#cf9350",
    sun: "#c14f22", sunGlow: "#a63f1c",
    birds: "#7a4a2a",
    far: "#d6ac79", farLit: "#e2be8c",
    mid: "#bb8f58", midLit: "#cba169", midShade: "#a97d49",
    near: "#8a5f3a", nearLit: "#9a7048", nearShade: "#795232",
    band: "#3d4a33",
    ground0: "#b5793a", ground1: "#9c6230", path: "#d9a967",
    tree0d: "#2e5140", tree0l: "#3a614c",
    tree1d: "#274536", tree1l: "#325544",
    tree2d: "#203a2e", tree2l: "#2b4a3a",
  },
  winter: {
    sky0: "#e5eaee", sky1: "#c3cfd9", sky2: "#9fb2c2",
    sun: "#e9dab6", sunGlow: "#cdbf9e",
    birds: "#5a6570",
    far: "#cbd5dc", farLit: "#dae2e7",
    mid: "#a8b9c3", midLit: "#b8c7d0", midShade: "#97a9b4",
    near: "#6e8290", nearLit: "#7e93a0", nearShade: "#5e717e",
    band: "#2a4438",
    ground0: "#e7ecef", ground1: "#d4dde2", path: "#bac8d1",
    tree0d: "#24493a", tree0l: "#2f5a46",
    tree1d: "#1e3d31", tree1l: "#284d3d",
    tree2d: "#18332a", tree2l: "#224438",
  },
  spring: {
    sky0: "#eff0d9", sky1: "#dce4ba", sky2: "#c5d59d",
    sun: "#dfad3b", sunGlow: "#c8862e",
    birds: "#6d5a33",
    far: "#cdd7a3", farLit: "#dbe3b5",
    mid: "#a9c189", midLit: "#b9ce99", midShade: "#97ae78",
    near: "#608b60", nearLit: "#709b6e", nearShade: "#537b53",
    band: "#2e5d42",
    ground0: "#a9c56b", ground1: "#90af55", path: "#ddd89c",
    tree0d: "#1f4d38", tree0l: "#2b6248",
    tree1d: "#193f2e", tree1l: "#26573f",
    tree2d: "#14352a", tree2l: "#1f4d38",
  },
};

// Meteorological seasons, northern hemisphere. The close date decides.
export function seasonFor(date = new Date()) {
  const m = (date instanceof Date ? date : new Date(date)).getUTCMonth() + 1;
  if (m >= 3 && m <= 5) return "spring";
  if (m >= 6 && m <= 8) return "summer";
  if (m >= 9 && m <= 11) return "fall";
  return "winter";
}
