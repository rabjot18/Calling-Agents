import "server-only";
import crypto from "node:crypto";

// Encrypts integration secrets (OAuth refresh tokens) at rest. AES-256-GCM, key = TOKEN_KEY (32 bytes, base64).
// Format: "v1:<iv>:<tag>:<ciphertext>", all base64.
function key(): Buffer {
  const k = Buffer.from(process.env.TOKEN_KEY ?? "", "base64");
  if (k.length !== 32) throw new Error("TOKEN_KEY is missing or not 32 bytes (base64).");
  return k;
}

export function seal(plain: string): string {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return ["v1", iv.toString("base64"), c.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split(":");
  if (v !== "v1") throw new Error("Unknown secret format");
  const d = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([d.update(Buffer.from(enc, "base64")), d.final()]).toString("utf8");
}
