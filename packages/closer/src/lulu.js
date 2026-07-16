// Lulu Print API client: token + print-job creation. The pod package is the
// locked spec: digest 5.5x8.5, B&W standard on 60# uncoated, matte color
// cover, perfect-bound (always PB — cheaper than saddle stitch at every page
// count, decided from real quotes).

export const POD_PACKAGE_ID = "0550X0850.BW.STD.PB.060UW444.MXX";

export async function luluToken(env) {
  const res = await fetch(`${env.LULU_BASE}/auth/realms/glasstree/protocol/openid-connect/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: "Basic " + btoa(`${env.LULU_CLIENT_KEY}:${env.LULU_CLIENT_SECRET}`),
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`Lulu auth failed (${res.status})`);
  return (await res.json()).access_token;
}

export async function createPrintJob(env, { issue, user, interiorUrl, coverUrl }) {
  const token = await luluToken(env);
  const body = {
    contact_email: user.email,
    external_id: issue.id,
    line_items: [
      {
        external_id: issue.id,
        title: `Dead Tree Digest — Issue No ${issue.number}`,
        quantity: 1,
        printable_normalization: {
          pod_package_id: POD_PACKAGE_ID,
          interior: { source_url: interiorUrl },
          cover: { source_url: coverUrl },
        },
      },
    ],
    shipping_address: {
      name: user.ship_name,
      street1: user.ship_street1,
      ...(user.ship_street2 ? { street2: user.ship_street2 } : {}),
      city: user.ship_city,
      state_code: user.ship_state,
      postcode: user.ship_postcode,
      country_code: user.ship_country ?? "US",
      phone_number: user.ship_phone,
    },
    shipping_level: "MAIL",
  };

  const res = await fetch(`${env.LULU_BASE}/print-jobs/`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`print job failed (${res.status}): ${JSON.stringify(json).slice(0, 400)}`);
  return json; // { id, status: { name }, ... }
}
