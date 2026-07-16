// HMAC-signed file URLs: Lulu (and the review email's preview links) fetch
// issue PDFs from R2 through the API worker. The signature covers the R2 key,
// so a URL grants access to exactly one object.

const enc = new TextEncoder();

async function hmacKey(secret) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [
    "sign",
    "verify",
  ]);
}

export async function signKey(secret, r2Key) {
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(r2Key));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyKey(secret, r2Key, hex) {
  if (!hex || hex.length !== 64) return false;
  const bytes = new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));
  return crypto.subtle.verify("HMAC", await hmacKey(secret), bytes, enc.encode(r2Key));
}

export async function signedFileUrl(secret, apiBase, r2Key) {
  return `${apiBase}/files/${r2Key}?sig=${await signKey(secret, r2Key)}`;
}
