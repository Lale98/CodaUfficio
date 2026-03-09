const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 2323;
const HOST = process.env.HOST || "0.0.0.0";

app.use(express.json({ limit: "20mb" }));
app.use(express.static(path.join(__dirname, "public")));

const store = {
  queueNumber: 0,
  users: {
    ivan: { name: "Ivan", status: "libero", servingNumber: 0 },
    antonio: { name: "Antonio", status: "occupato", servingNumber: 0 }
  },
  sound: {
    enabled: true,
    users: {
      ivan: { dataUrl: null, version: 0 },
      antonio: { dataUrl: null, version: 0 }
    }
  }
};

function createEmptySoundState() {
  return { dataUrl: null, version: 0 };
}

function syncQueueFromUsers() {
  store.queueNumber = Math.max(
    0,
    ...Object.values(store.users).map((user) => user.servingNumber)
  );
}

function normalizeName(value) {
  return String(value || "").trim().toLowerCase();
}

function createUserKey(name) {
  return String(name || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function normalizeStatus(value) {
  const status = String(value || "").trim().toLowerCase();
  if (status === "libero" || status === "occupato") {
    return status;
  }
  return null;
}

function getUserSoundState(userKey) {
  return store.sound.users[userKey];
}

app.get("/api/state", (_req, res) => {
  res.json({
    queueNumber: store.queueNumber,
    users: store.users,
    sound: {
      enabled: store.sound.enabled,
      users: Object.fromEntries(
        Object.keys(store.sound.users).map((key) => [
          key,
          {
            configured: Boolean(store.sound.users[key].dataUrl),
            version: store.sound.users[key].version
          }
        ])
      )
    }
  });
});

app.post("/api/sound/enabled", (req, res) => {
  const enabled = req.body?.enabled;
  if (typeof enabled !== "boolean") {
    return res.status(400).json({ error: "enabled deve essere true o false" });
  }

  store.sound.enabled = enabled;
  return res.json({ ok: true, enabled: store.sound.enabled });
});

app.post("/api/users", (req, res) => {
  const name = String(req.body?.name || "").trim();
  const key = createUserKey(name);

  if (!name) {
    return res.status(400).json({ error: "Nome collega obbligatorio" });
  }

  if (!key) {
    return res.status(400).json({ error: "Nome collega non valido" });
  }

  if (store.users[key]) {
    return res.status(409).json({ error: "Collega gia esistente" });
  }

  store.users[key] = { name, status: "libero", servingNumber: 0 };
  store.sound.users[key] = createEmptySoundState();

  return res.status(201).json({
    ok: true,
    key,
    user: store.users[key]
  });
});

app.delete("/api/users/:name", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const user = store.users[userKey];

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  delete store.users[userKey];
  delete store.sound.users[userKey];
  syncQueueFromUsers();

  return res.json({ ok: true, removed: userKey, queueNumber: store.queueNumber });
});

app.get("/api/sound/:name", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const userSound = getUserSoundState(userKey);

  if (!userSound) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  if (!userSound.dataUrl) {
    return res.status(404).json({ error: "Nessun suono configurato" });
  }

  return res.json({
    dataUrl: userSound.dataUrl,
    version: userSound.version
  });
});

app.post("/api/users/:name/status", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const user = store.users[userKey];
  const status = normalizeStatus(req.body?.status);

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  if (!status) {
    return res
      .status(400)
      .json({ error: "Status non valido. Usa 'libero' o 'occupato'" });
  }

  user.status = status;
  return res.json({ ok: true, user });
});

app.post("/api/users/:name/increment", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const user = store.users[userKey];

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  store.queueNumber += 1;
  user.servingNumber = store.queueNumber;
  return res.json({
    ok: true,
    queueNumber: store.queueNumber,
    user
  });
});

app.post("/api/users/:name/decrement", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const user = store.users[userKey];

  if (!user) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  user.servingNumber = Math.max(0, user.servingNumber - 1);
  syncQueueFromUsers();

  return res.json({
    ok: true,
    queueNumber: store.queueNumber,
    user
  });
});

app.post("/api/queue/reset", (_req, res) => {
  store.queueNumber = 0;
  Object.values(store.users).forEach((user) => {
    user.servingNumber = 0;
  });
  return res.json({ ok: true, queueNumber: store.queueNumber });
});

app.post("/api/sound/:name", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const userSound = getUserSoundState(userKey);
  const dataUrl = String(req.body?.dataUrl || "");
  const isAudioDataUrl = /^data:audio\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl);

  if (!userSound) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  if (!isAudioDataUrl) {
    return res.status(400).json({
      error: "Formato non valido. Invia un data URL base64 di un file audio"
    });
  }

  if (dataUrl.length > 20 * 1024 * 1024) {
    return res.status(400).json({ error: "File audio troppo grande" });
  }

  userSound.dataUrl = dataUrl;
  userSound.version += 1;
  return res.json({ ok: true, version: userSound.version, user: userKey });
});

app.delete("/api/sound/:name", (req, res) => {
  const userKey = normalizeName(req.params.name);
  const userSound = getUserSoundState(userKey);

  if (!userSound) {
    return res.status(404).json({ error: "Utente non trovato" });
  }

  userSound.dataUrl = null;
  userSound.version += 1;
  return res.json({ ok: true, version: userSound.version, user: userKey });
});

app.listen(PORT, HOST, () => {
  console.log(`CodaUfficio avviato su http://localhost:${PORT}`);
});




