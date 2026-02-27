const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const request = require("supertest");
const { createApp } = require("../src/app");
const { QrStore } = require("../src/store");

async function createTestContext(t) {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "qrdinamic-"));
  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const store = new QrStore(path.join(tmpDir, "qrs.json"));
  await store.init();
  const app = createApp({ store, fallbackUrl: "/qr/not-found" });

  return { app, store };
}

test("create + redirect + metrics", async (t) => {
  const { app } = await createTestContext(t);

  const createResponse = await request(app).post("/api/qrs").send({
    slug: "doflins-mv-2026",
    destination_url: "https://dofer.mx/campana",
    name: "Campaña principal"
  });

  assert.equal(createResponse.statusCode, 201);
  assert.equal(createResponse.body.slug, "doflins-mv-2026");
  assert.equal(createResponse.body.total_clicks, 0);

  const redirectResponse = await request(app).get("/qr/doflins-mv-2026");
  assert.equal(redirectResponse.statusCode, 302);
  assert.equal(redirectResponse.headers.location, "https://dofer.mx/campana");

  const detailResponse = await request(app).get("/api/qrs/doflins-mv-2026");
  assert.equal(detailResponse.statusCode, 200);
  assert.equal(detailResponse.body.total_clicks, 1);
  assert.ok(detailResponse.body.last_click_at);
});

test("slug inválido se rechaza", async (t) => {
  const { app } = await createTestContext(t);

  const response = await request(app).post("/api/qrs").send({
    slug: "con espacios",
    destination_url: "https://dofer.mx"
  });

  assert.equal(response.statusCode, 400);
});

test("slug duplicado se rechaza", async (t) => {
  const { app } = await createTestContext(t);

  await request(app).post("/api/qrs").send({
    slug: "promo-2026",
    destination_url: "https://dofer.mx/a"
  });

  const duplicated = await request(app).post("/api/qrs").send({
    slug: "promo-2026",
    destination_url: "https://dofer.mx/b"
  });

  assert.equal(duplicated.statusCode, 409);
});

test("QR inactivo redirige al fallback", async (t) => {
  const { app } = await createTestContext(t);

  await request(app).post("/api/qrs").send({
    slug: "evento-2026",
    destination_url: "https://dofer.mx/evento"
  });

  const deactivateResponse = await request(app).post(
    "/api/qrs/evento-2026/deactivate"
  );
  assert.equal(deactivateResponse.statusCode, 200);
  assert.equal(deactivateResponse.body.is_active, false);

  const redirectResponse = await request(app).get("/qr/evento-2026");
  assert.equal(redirectResponse.statusCode, 302);
  assert.equal(redirectResponse.headers.location, "/qr/not-found");
});

test("si destination_url almacenado es inválido usa fallback", async (t) => {
  const { app, store } = await createTestContext(t);

  await store.create({
    slug: "corrupto",
    destinationUrl: "https://dofer.mx/original",
    name: null
  });

  await store.update("corrupto", { destinationUrl: "ftp://broken-link" });
  const redirectResponse = await request(app).get("/qr/corrupto");

  assert.equal(redirectResponse.statusCode, 302);
  assert.equal(redirectResponse.headers.location, "/qr/not-found");
});

test("si falla tracking la redirección continúa", async (t) => {
  const { app, store } = await createTestContext(t);

  await store.create({
    slug: "sin-metrica",
    destinationUrl: "https://dofer.mx/ok",
    name: null
  });

  store.trackClick = async () => {
    throw new Error("storage down");
  };

  const redirectResponse = await request(app).get("/qr/sin-metrica");
  assert.equal(redirectResponse.statusCode, 302);
  assert.equal(redirectResponse.headers.location, "https://dofer.mx/ok");
});

test("genera QR SVG para un slug existente", async (t) => {
  const { app } = await createTestContext(t);

  await request(app).post("/api/qrs").send({
    slug: "con-qr-svg",
    destination_url: "https://dofer.mx/landing"
  });

  const response = await request(app).get("/api/qrs/con-qr-svg/qr?format=svg");

  assert.equal(response.statusCode, 200);
  assert.match(response.headers["content-type"], /image\/svg\+xml/);
  const bodyText = Buffer.from(response.body).toString("utf8");
  assert.match(bodyText, /<svg/);
});

test("rechaza formato de QR inválido", async (t) => {
  const { app } = await createTestContext(t);

  await request(app).post("/api/qrs").send({
    slug: "formato-invalido",
    destination_url: "https://dofer.mx/landing"
  });

  const response = await request(app).get(
    "/api/qrs/formato-invalido/qr?format=jpeg"
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.error, /format inválido/);
});

test("si slug no existe no genera QR", async (t) => {
  const { app } = await createTestContext(t);

  const response = await request(app).get("/api/qrs/no-existe/qr");
  assert.equal(response.statusCode, 404);
});
