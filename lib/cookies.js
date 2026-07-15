import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getKey() {
  const k = process.env.ENCRYPTION_KEY;
  if (!k || k.length !== 64) {
    throw new Error(
      "ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
    );
  }
  return Buffer.from(k, "hex");
}

export function encrypt(obj) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const data = Buffer.from(JSON.stringify(obj), "utf8");
  const enc = Buffer.concat([cipher.update(data), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString("hex") + ":" + tag.toString("hex") + ":" + enc.toString("hex");
}

export function decrypt(str) {
  const [iv, tag, enc] = str.split(":");
  const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(tag, "hex"));
  const dec = Buffer.concat([decipher.update(Buffer.from(enc, "hex")), decipher.final()]);
  return JSON.parse(dec.toString("utf8"));
}
