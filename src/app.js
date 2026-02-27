const express = require("express");
const { isValidDestinationUrl, isValidSlug } = require("./validators");

function toApiModel(record) {
  return {
    slug: record.slug,
    name: record.name,
    destination_url: record.destinationUrl,
    is_active: Boolean(record.isActive),
    total_clicks: Number(record.totalClicks || 0),
    last_click_at: record.lastClickAt,
    created_at: record.createdAt,
    updated_at: record.updatedAt
  };
}

function normalizeOptionalName(value) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length === 0 ? null : normalized;
}

function createApp({ store, fallbackUrl }) {
  const app = express();
  app.use(express.json());

  app.get("/", (_req, res) => {
    res.json({
      message: "QR dinámico listo",
      redirect_pattern: "/qr/{slug}"
    });
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/qr/not-found", (_req, res) => {
    res.status(404).send("QR no válido");
  });

  app.get("/qr/:slug", async (req, res) => {
    const { slug } = req.params;
    const record = store.getBySlug(slug);

    if (!record || !record.isActive) {
      return res.redirect(302, fallbackUrl);
    }

    if (!isValidDestinationUrl(record.destinationUrl)) {
      return res.redirect(302, fallbackUrl);
    }

    try {
      await store.trackClick(slug);
    } catch (error) {
      console.error("Failed to store metrics:", error);
    }

    return res.redirect(302, record.destinationUrl);
  });

  app.post("/api/qrs", async (req, res) => {
    const { slug, destination_url: destinationUrl, name } = req.body || {};

    if (!isValidSlug(slug)) {
      return res.status(400).json({
        error:
          "slug inválido: usa solo letras, números o guiones, sin espacios"
      });
    }

    if (!isValidDestinationUrl(destinationUrl)) {
      return res.status(400).json({
        error: "destination_url inválido: debe iniciar con http:// o https://"
      });
    }

    const normalizedName = normalizeOptionalName(name);
    if (name !== undefined && normalizedName === undefined) {
      return res.status(400).json({
        error: "name debe ser string o null"
      });
    }

    try {
      const created = await store.create({
        slug: slug.trim(),
        destinationUrl: destinationUrl.trim(),
        name: normalizedName
      });

      return res.status(201).json(toApiModel(created));
    } catch (error) {
      if (error.code === "CONFLICT") {
        return res.status(409).json({
          error: "slug ya existe"
        });
      }
      throw error;
    }
  });

  app.get("/api/qrs", (req, res) => {
    const search =
      typeof req.query.search === "string" ? req.query.search : undefined;
    const items = store.list(search).map(toApiModel);
    res.json({
      total: items.length,
      items
    });
  });

  app.get("/api/qrs/:slug", (req, res) => {
    const record = store.getBySlug(req.params.slug);
    if (!record) {
      return res.status(404).json({ error: "QR no encontrado" });
    }
    return res.json(toApiModel(record));
  });

  app.patch("/api/qrs/:slug", async (req, res) => {
    const slug = req.params.slug;
    const current = store.getBySlug(slug);
    if (!current) {
      return res.status(404).json({ error: "QR no encontrado" });
    }

    const patch = {};
    const { destination_url: destinationUrl, name, is_active: isActive } =
      req.body || {};

    if (destinationUrl !== undefined) {
      if (!isValidDestinationUrl(destinationUrl)) {
        return res.status(400).json({
          error: "destination_url inválido: debe iniciar con http:// o https://"
        });
      }
      patch.destinationUrl = destinationUrl.trim();
    }

    if (name !== undefined) {
      const normalizedName = normalizeOptionalName(name);
      if (normalizedName === undefined) {
        return res.status(400).json({
          error: "name debe ser string o null"
        });
      }
      patch.name = normalizedName;
    }

    if (isActive !== undefined) {
      if (typeof isActive !== "boolean") {
        return res.status(400).json({
          error: "is_active debe ser boolean"
        });
      }
      patch.isActive = isActive;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error:
          "envía al menos uno de estos campos: destination_url, name, is_active"
      });
    }

    const updated = await store.update(slug, patch);
    return res.json(toApiModel(updated));
  });

  app.post("/api/qrs/:slug/activate", async (req, res) => {
    const updated = await store.setActive(req.params.slug, true);
    if (!updated) {
      return res.status(404).json({ error: "QR no encontrado" });
    }
    return res.json(toApiModel(updated));
  });

  app.post("/api/qrs/:slug/deactivate", async (req, res) => {
    const updated = await store.setActive(req.params.slug, false);
    if (!updated) {
      return res.status(404).json({ error: "QR no encontrado" });
    }
    return res.json(toApiModel(updated));
  });

  app.use((err, _req, res, next) => {
    if (err instanceof SyntaxError && "body" in err) {
      return res.status(400).json({ error: "JSON inválido en request body" });
    }
    return next(err);
  });

  return app;
}

module.exports = {
  createApp
};
