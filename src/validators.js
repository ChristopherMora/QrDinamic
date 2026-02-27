const SLUG_REGEX = /^[a-zA-Z0-9-]+$/;

function isValidSlug(slug) {
  if (typeof slug !== "string") {
    return false;
  }

  const value = slug.trim();
  if (value.length === 0) {
    return false;
  }

  return SLUG_REGEX.test(value);
}

function parseHttpUrl(rawUrl) {
  if (typeof rawUrl !== "string") {
    return null;
  }

  const value = rawUrl.trim();
  if (value.length === 0) {
    return null;
  }

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function isValidDestinationUrl(rawUrl) {
  return parseHttpUrl(rawUrl) !== null;
}

module.exports = {
  isValidSlug,
  isValidDestinationUrl
};
