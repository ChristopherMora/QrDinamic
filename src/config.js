const path = require("path");

function normalizeFallback(fallbackValue) {
  if (!fallbackValue || typeof fallbackValue !== "string") {
    return "/qr/not-found";
  }

  const trimmed = fallbackValue.trim();
  if (trimmed.length === 0) {
    return "/qr/not-found";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return trimmed;
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function normalizePublicBaseUrl(baseUrlValue) {
  if (!baseUrlValue || typeof baseUrlValue !== "string") {
    return null;
  }

  const trimmed = baseUrlValue.trim();
  if (trimmed.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

module.exports = {
  port: Number(process.env.PORT) || 3000,
  dataFilePath:
    process.env.DATA_FILE_PATH || path.join(process.cwd(), "data", "qrs.json"),
  fallbackUrl: normalizeFallback(process.env.FALLBACK_URL),
  publicBaseUrl: normalizePublicBaseUrl(process.env.PUBLIC_BASE_URL)
};
