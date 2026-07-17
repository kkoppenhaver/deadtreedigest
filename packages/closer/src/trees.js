// Tree planting via DigitalHumani (RaaS): $1/tree, invoiced monthly by the
// reforestation org directly. We plant with TIST Kenya (project pinned in
// config) — 25 years of third-party-verified smallholder planting. Ten trees
// per printed issue, attributed to the subscriber.

export const TREES_PER_ISSUE = 10;

export async function plantTrees(env, { userId, count = TREES_PER_ISSUE }) {
  const res = await fetch("https://api.digitalhumani.com/tree", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Api-Key": env.DH_API_KEY },
    body: JSON.stringify({
      enterpriseId: env.DH_ENTERPRISE_ID,
      projectId: env.DH_PROJECT_ID,
      user: userId,
      treeCount: count,
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`tree planting failed (${res.status}): ${JSON.stringify(json).slice(0, 200)}`);
  return json; // { uuid, created, treeCount, ... }
}
