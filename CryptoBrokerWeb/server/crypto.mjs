import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes } from "node:crypto";

const CRYPTO_SECRET = process.env.CRYPTOBROKER_SECRET || "cryptobroker-dev-secret-change-me";
const CRYPTO_SALT = "cryptobroker-message-container-v1";
const ALGORITHM = "AES-256-GCM";

function cryptoKey() {
  return pbkdf2Sync(CRYPTO_SECRET, CRYPTO_SALT, 120_000, 32, "sha256");
}

export function createCryptoContainer(plainText, metadata) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata), "utf8"));

  const ciphertext = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    version: 1,
    algorithm: ALGORITHM,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
    metadata,
  };
}

export function decryptCryptoContainer(container) {
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(container.iv, "base64"));
  decipher.setAAD(Buffer.from(JSON.stringify(container.metadata), "utf8"));
  decipher.setAuthTag(Buffer.from(container.authTag, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(container.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export function verifyCryptoContainer(container) {
  try {
    decryptCryptoContainer(container);
    return true;
  } catch {
    return false;
  }
}
