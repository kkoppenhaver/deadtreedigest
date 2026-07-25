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
