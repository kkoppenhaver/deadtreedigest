// Seasonal cover palettes (issue #12: National Park poster series). The
// close date picks the season, the close hour picks day or night, the
// locale picks the scene. The spine and back cover TINT with the palette
// (the rainbow shelf) while their type, layout, and cream ink never change —
// that constancy is what keeps twelve issues reading as a matched set.
// Summer day is the founding palette: its tokens are the exact hexes the
// original cover shipped with, so Issue № 1 remains the canonical cover.
//
// Token roles (every scene draws from these):
//   sky0/1/2            sky gradient, top -> horizon
//   sun, sunGlow        the light source disc and its halo (moon at night)
//   birds               small accent linework in the sky (day only)
//   stars               star specks (night only)
//   far/farLit          most distant land layer (haziest, nearest sky value)
//   mid/midLit/midShade middle land layer
//   near/nearLit/nearShade  nearest big land layer
//   band                dark silhouette band (treeline, skyline, reeds)
//   ground0/ground1     foreground field, light then deep
//   path                the winding trail
//   water0/water1       open water, light then deep (lakefront, swamp)
//   canopy0/canopy1     deciduous canopy, lit/shade (the prairie oak —
//                       bare in fall; marcescent brown in winter)
//   tree0d/0l 1d/1l 2d/2l  the hero pine's three tiers, dark/lit facets
//   spine, back         the wrap: spine band + back cover background
//   night               flag: scenes swap sun/birds for moon/stars
//
// The stump, saplings, and trunks keep their fixed browns and greens in
// every palette — they are the brand motif, not scenery.

const summerDay = {
  night: false,
  sky0: "#f2ddaa", sky1: "#e8c579", sky2: "#dcaa55",
  sun: "#c65a2e", sunGlow: "#bf4e24",
  birds: "#8a5a33", stars: null,
  far: "#d3bd85", farLit: "#dcc794",
  mid: "#a3ad7c", midLit: "#b1ba8a", midShade: "#95a06f",
  near: "#5d7a55", nearLit: "#6a8961", nearShade: "#516d4b",
  band: "#31543f",
  ground0: "#c9a94f", ground1: "#b8923e", path: "#dcc17a",
  tree0d: "#1f4d38", tree0l: "#2b6248",
  tree1d: "#193f2e", tree1l: "#26573f",
  tree2d: "#14352a", tree2l: "#1f4d38",
  spine: "#bf4e24", back: "#14352a",
    water0: "#6d9aa8", water1: "#588594",
    canopy0: "#4a7c4a", canopy1: "#38663c",
};

export const PALETTES = {
  summer: {
    day: summerDay,
    night: {
      night: true,
      sky0: "#2c3e56", sky1: "#1f2d42", sky2: "#15202f",
      sun: "#f2e6c4", sunGlow: "#d9cba0",
      birds: null, stars: "#e8dcb8",
      far: "#3d5066", farLit: "#485c72",
      mid: "#304354", midLit: "#3b4f60", midShade: "#28394a",
      near: "#233440", nearLit: "#2d3f4b", nearShade: "#1d2c36",
      band: "#111f26",
      ground0: "#2e4348", ground1: "#26383d", path: "#546d76",
      tree0d: "#1a4030", tree0l: "#24503c",
      tree1d: "#153428", tree1l: "#1f4432",
      tree2d: "#112b22", tree2l: "#193c2c",
      spine: "#2f4256", back: "#101c28",
    water0: "#2c4456", water1: "#24384a",
    canopy0: "#274a34", canopy1: "#1e3a2a",
    },
  },
  fall: {
    day: {
      night: false,
      sky0: "#f2d9ae", sky1: "#e3b877", sky2: "#cf9350",
      sun: "#c14f22", sunGlow: "#a63f1c",
      birds: "#7a4a2a", stars: null,
      far: "#d6ac79", farLit: "#e2be8c",
      mid: "#bb8f58", midLit: "#cba169", midShade: "#a97d49",
      near: "#8a5f3a", nearLit: "#9a7048", nearShade: "#795232",
      band: "#3d4a33",
      ground0: "#b5793a", ground1: "#9c6230", path: "#d9a967",
      tree0d: "#2e5140", tree0l: "#3a614c",
      tree1d: "#274536", tree1l: "#325544",
      tree2d: "#203a2e", tree2l: "#2b4a3a",
      spine: "#a63f1c", back: "#382516",
    water0: "#7d9695", water1: "#68807f",
    canopy0: "#b56a30", canopy1: "#9a5426", // unused while the oak stands bare — defined so every palette carries every token
    },
    night: {
      night: true,
      sky0: "#37293f", sky1: "#281e30", sky2: "#1a1422",
      sun: "#f0c56a", sunGlow: "#c9a04e", // the harvest moon
      birds: null, stars: "#dcc9a2",
      far: "#5f4739", farLit: "#6d5445",
      mid: "#4b3628", midLit: "#584232", midShade: "#3e2c20",
      near: "#37271c", nearLit: "#423023", nearShade: "#2d1f16",
      band: "#1c2820",
      ground0: "#412f20", ground1: "#352619", path: "#6d5136",
      tree0d: "#22402f", tree0l: "#2c4e3a",
      tree1d: "#1c3527", tree1l: "#254232",
      tree2d: "#162b20", tree2l: "#1e3829",
      spine: "#6b3b22", back: "#201626",
    water0: "#2f3a4c", water1: "#262f3f",
    canopy0: "#5c3a22", canopy1: "#4a2e1a",
    },
  },
  winter: {
    day: {
      night: false,
      sky0: "#e5eaee", sky1: "#c3cfd9", sky2: "#9fb2c2",
      sun: "#e9dab6", sunGlow: "#cdbf9e",
      birds: "#5a6570", stars: null,
      far: "#cbd5dc", farLit: "#dae2e7",
      mid: "#a8b9c3", midLit: "#b8c7d0", midShade: "#97a9b4",
      near: "#6e8290", nearLit: "#7e93a0", nearShade: "#5e717e",
      band: "#2a4438",
      ground0: "#e7ecef", ground1: "#d4dde2", path: "#bac8d1",
      tree0d: "#24493a", tree0l: "#2f5a46",
      tree1d: "#1e3d31", tree1l: "#284d3d",
      tree2d: "#18332a", tree2l: "#224438",
      spine: "#4a6478", back: "#1c2b38",
    water0: "#8aa2b5", water1: "#7590a5",
    canopy0: "#a08258", canopy1: "#8a6f4e", // burr oaks hold their dead leaves all winter (marcescence)
    },
    night: {
      night: true,
      sky0: "#1d2b3c", sky1: "#15202e", sky2: "#0e1722",
      sun: "#eef0e6", sunGlow: "#c8d2d8",
      birds: null, stars: "#dfe6ee",
      far: "#4d5f73", farLit: "#596b7e",
      mid: "#3a4c5f", midLit: "#455a6c", midShade: "#314153",
      near: "#293a4a", nearLit: "#334656", nearShade: "#22303d",
      band: "#13251d",
      ground0: "#8fa3b4", ground1: "#7a8ea0", path: "#a9bcca", // moonlit snow still glows
      tree0d: "#183527", tree0l: "#214332",
      tree1d: "#132c21", tree1l: "#1b382a",
      tree2d: "#0f241b", tree2l: "#163024",
      spine: "#2c3d4e", back: "#0e1722",
    water0: "#35485c", water1: "#2a3a4b",
    canopy0: "#4a3e30", canopy1: "#3a3126",
    },
  },
  spring: {
    day: {
      night: false,
      sky0: "#eff0d9", sky1: "#dce4ba", sky2: "#c5d59d",
      sun: "#dfad3b", sunGlow: "#c8862e",
      birds: "#6d5a33", stars: null,
      far: "#cdd7a3", farLit: "#dbe3b5",
      mid: "#a9c189", midLit: "#b9ce99", midShade: "#97ae78",
      near: "#608b60", nearLit: "#709b6e", nearShade: "#537b53",
      band: "#2e5d42",
      ground0: "#a9c56b", ground1: "#90af55", path: "#ddd89c",
      tree0d: "#1f4d38", tree0l: "#2b6248",
      tree1d: "#193f2e", tree1l: "#26573f",
      tree2d: "#14352a", tree2l: "#1f4d38",
      spine: "#7d9b52", back: "#223a28",
    water0: "#7fa89b", water1: "#6a9388",
    canopy0: "#83ac59", canopy1: "#6f9a4a",
    },
    night: {
      night: true,
      sky0: "#2b434a", sky1: "#1f3339", sky2: "#152528",
      sun: "#edeacb", sunGlow: "#c9cba6",
      birds: null, stars: "#dfe6cf",
      far: "#415c54", farLit: "#4c6a60",
      mid: "#354b41", midLit: "#40584c", midShade: "#2c3f37",
      near: "#273c34", nearLit: "#30483e", nearShade: "#20322b",
      band: "#12241b",
      ground0: "#2f4b37", ground1: "#273e2d", path: "#52704f",
      tree0d: "#1a4030", tree0l: "#24503c",
      tree1d: "#153428", tree1l: "#1f4432",
      tree2d: "#112b22", tree2l: "#193c2c",
      spine: "#3f5a52", back: "#13251c",
    water0: "#2e4a4a", water1: "#253c3c",
    canopy0: "#375a3a", canopy1: "#2c4a30",
    },
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

// Day or night edition: the LOCAL close hour decides, approximated from the
// subscriber's longitude (15° per hour). An issue that fills at 11pm wears
// the night cover — the cover remembers when you finished it.
export function timeFor(date = new Date(), lng = null) {
  const d = date instanceof Date ? date : new Date(date);
  const offset = lng == null ? 0 : Math.round(lng / 15);
  const hour = (((d.getUTCHours() + offset) % 24) + 24) % 24;
  return hour >= 19 || hour < 6 ? "night" : "day";
}
