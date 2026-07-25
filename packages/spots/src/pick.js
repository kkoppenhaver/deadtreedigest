// The editorial pick: hand the candidate list to Claude (Haiku-class per the
// SPEC decision — cheap, fast, and the task is one line of taste), get back
// ONE spot and one line in house voice. Falls back to a deterministic pick
// when there's no API key or the call fails — a spot page/print that works
// without the LLM beats one that doesn't.

import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-haiku-4-5";

const PICK_SCHEMA = {
  type: "object",
  properties: {
    index: { type: "integer", description: "Index of the chosen candidate" },
    copy: { type: "string", description: "One line introducing the spot, house voice" },
  },
  required: ["index", "copy"],
  additionalProperties: false,
};

const SYSTEM = `You pick ONE reading spot from a list of candidates near someone's location, for Dead Tree Digest — a service that prints people's saved articles into a magazine. You are choosing where they should sit and read it.

Taste: prefer the spot with the most character, not the closest. A named bench beats an anonymous one; a viewpoint, pier, lighthouse, or quiet cemetery beats a generic park; a bench WITH a backrest beats one without when they are otherwise equal. Avoid picking something that is obviously a traffic island or parking-lot furniture.

Then write ONE line (under 160 characters) introducing it. These editor-approved lines are the register — match them:
- "Graceland Cemetery, an oasis in a grid of busy streets."
- "The Montrose Moonrise Observation Point, a short walk east. You'll understand the name when you see the view."
- "The viewpoint at 795 meters. The walk is worth it for what you'll see from up there."
- "Light House Landing Park is a short walk away. The lighthouse gives you something to look at as you contemplate what you just read."
- "Paseo Prairie Garden, a fifteen-minute walk. Native grasses and wildflowers make this the kind of place where you forget you're still in the city."

Rules:
- Plain, warm, concrete, a little dry. Full sentences, never stacked fragments.
- At most one concrete image. Never personify objects or scenery (no monuments listening, no views doing things).
- The reader is walking there to read a printed magazine. A quiet nod to that is welcome, not required.
- Distances and walk times: use ONLY the figures given in the candidate line, or leave them out. Never invent a duration.
- No em dashes. No exclamation points. No "hidden gem" or "perfect spot" cliches.`;

export async function pickSpot({ candidates, apiKey }) {
  if (!candidates.length) return null;
  if (apiKey) {
    try {
      return await llmPick(candidates, apiKey);
    } catch (err) {
      console.error(`spot pick fell back: ${err.message}`);
    }
  }
  return fallbackPick(candidates);
}

async function llmPick(candidates, apiKey) {
  const client = new Anthropic({ apiKey });
  const list = candidates
    .slice(0, 50)
    .map(
      (c, i) =>
        `${i}. ${c.kind}${c.name ? ` "${c.name}"` : ""} · ${c.meters}m (~${Math.max(1, Math.round(c.meters / 80))} min walk)` +
        (c.backrest ? ` · backrest=${c.backrest}` : "") +
        (c.direction ? ` · faces ${c.direction}` : "")
    )
    .join("\n");

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    system: SYSTEM,
    output_config: { format: { type: "json_schema", schema: PICK_SCHEMA } },
    messages: [{ role: "user", content: `Candidates:\n${list}\n\nPick one and write the line.` }],
  });
  if (response.stop_reason === "refusal") throw new Error("pick refused");
  const parsed = JSON.parse(response.content.find((b) => b.type === "text").text);
  const spot = candidates[parsed.index];
  if (!spot) throw new Error(`pick index ${parsed.index} out of range`);
  return { spot, copy: String(parsed.copy).slice(0, 200), source: "llm" };
}

// Wayfinding color: Haiku attaches landmark parentheticals to the steps
// whose leg passes them. The numbered directions stay mechanical (a wrong
// turn strands someone; a missing parenthetical is just plainer) — the
// model only decorates, and every annotation is validated against the
// provided landmark names before it touches the page.
const ANNOTATE_SCHEMA = {
  type: "object",
  properties: {
    annotations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          step: { type: "integer", description: "1-based index of the direction line" },
          landmark: { type: "string", description: "Exact landmark name from the list" },
          phrase: { type: "string", description: "Short parenthetical, e.g. 'past St. Mary of the Lake'" },
        },
        required: ["step", "landmark", "phrase"],
        additionalProperties: false,
      },
    },
  },
  required: ["annotations"],
  additionalProperties: false,
};

const ANNOTATE_SYSTEM = `You add wayfinding color to numbered walking directions. You are given the directions (each with its distance) and a list of landmarks with how many meters into the walk each one sits. Attach a short parenthetical to the step whose leg passes a landmark — "past Holy Trinity Church", "just after the library", "across from Graeser Park".

Rules: use ONLY the provided landmark names, verbatim — keep their capitalization exactly as given ("past Uptown Branch Library", not "past uptown branch library"). Match landmarks to steps by comparing meters-into-the-walk against the cumulative step distances. At most 3 annotations, each under 50 characters, starting with a lowercase connective (past/just after/across from), no punctuation inside. When a landmark's meters-into-the-walk clearly falls within one step's leg, annotate that step — aim for one to three annotations whenever landmarks are provided. Skip only the genuinely ambiguous ones.`;

export async function annotateDirections({ directions, landmarks, apiKey }) {
  if (!apiKey || !directions.length || !landmarks.length) return directions;
  try {
    const client = new Anthropic({ apiKey });
    const list = directions.map((d, i) => `${i + 1}. ${d}`).join("\n");
    const lm = landmarks
      .map((l) => `- ${l.name} (${l.kind}, about ${l.metersAlong} m into the walk)`)
      .join("\n");
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: ANNOTATE_SYSTEM,
      output_config: { format: { type: "json_schema", schema: ANNOTATE_SCHEMA } },
      messages: [{ role: "user", content: `Directions:\n${list}\n\nLandmarks along the way:\n${lm}` }],
    });
    if (response.stop_reason === "refusal") return directions;
    const { annotations } = JSON.parse(response.content.find((b) => b.type === "text").text);
    const out = [...directions];
    for (const a of annotations ?? []) {
      const i = (a.step ?? 0) - 1;
      if (i < 0 || i >= out.length || out[i].includes("(")) continue;
      const named = landmarks.some((l) => String(a.phrase).toLowerCase().includes(l.name.toLowerCase()));
      if (!named) continue; // hallucinated landmark: drop silently
      out[i] = `${out[i]} (${String(a.phrase).replace(/[()]/g, "").slice(0, 60)})`;
    }
    return out;
  } catch (err) {
    console.error(`direction annotation skipped: ${err.message}`);
    return directions;
  }
}

// No LLM available: prefer character by kind, then named over anonymous,
// then backrest, then distance. Copy comes from per-kind templates.
const KIND_RANK = { viewpoint: 0, pier: 1, lighthouse: 2, "ferry terminal": 3, cemetery: 4, park: 5, bench: 6 };

function fallbackPick(candidates) {
  const scored = [...candidates].sort((a, b) => {
    const ka = KIND_RANK[a.kind] ?? 9;
    const kb = KIND_RANK[b.kind] ?? 9;
    if (ka !== kb) return ka - kb;
    if (!!b.name !== !!a.name) return b.name ? 1 : -1;
    if ((b.backrest === "yes") !== (a.backrest === "yes")) return b.backrest === "yes" ? 1 : -1;
    return a.meters - b.meters;
  });
  const spot = scored[0];
  const walk = Math.max(1, Math.round(spot.meters / 80));
  const where = spot.name ? `${spot.name}` : `a ${spot.kind}`;
  const copy =
    spot.kind === "bench"
      ? `A bench${spot.backrest === "yes" ? " with a backrest" : ""}${spot.name ? ` at ${spot.name}` : ""}, about a ${walk} minute walk. Bring the issue.`
      : `${where}, about a ${walk} minute walk. A good place to sit with an issue.`;
  return { spot, copy, source: "fallback" };
}
