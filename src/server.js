const { createApp } = require("./app");
const config = require("./config");
const { QrStore } = require("./store");

async function start() {
  const store = new QrStore(config.dataFilePath);
  await store.init();

  const app = createApp({
    store,
    fallbackUrl: config.fallbackUrl
  });

  app.listen(config.port, () => {
    console.log(`QR dinámico escuchando en http://localhost:${config.port}`);
    console.log(`Fallback configurado en: ${config.fallbackUrl}`);
  });
}

start().catch((error) => {
  console.error("No se pudo iniciar el servidor:", error);
  process.exit(1);
});
