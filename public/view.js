const peopleContainer = document.getElementById("people");
const audioByUser = {};

let lastQueueNumber = null;
let soundEnabled = true;
let previousServingByUser = {};
const lastSoundVersionByUser = {};

function applyDisplayLayout(userCount) {
  if (!peopleContainer) {
    return;
  }

  const safeCount = Math.max(1, userCount);
  const viewportRatio = window.innerWidth / Math.max(window.innerHeight, 1);
  const suggestedColumns = Math.ceil(Math.sqrt(safeCount * viewportRatio));
  const columns = Math.max(1, Math.min(safeCount, suggestedColumns));
  const rows = Math.ceil(safeCount / columns);
  const scale = Math.max(0.38, Math.min(1, 1 - (rows - 1) * 0.2));

  peopleContainer.style.setProperty("--display-columns", String(columns));
  peopleContainer.style.setProperty("--display-card-scale", scale.toFixed(3));
}

function userCard(user) {
  const isFree = user.status === "libero";
  return `
    <article class="person">
      <div class="person-name-row">
        <span class="dot ${isFree ? "free" : "busy"}"></span>
        <div class="person-name">${user.name}</div>
      </div>
      <div class="queue-text">SERVIAMO IL NUMERO ${user.servingNumber}</div>
    </article>
  `;
}

function ensureAudio(userKey) {
  if (!audioByUser[userKey]) {
    const audio = new Audio();
    audio.preload = "auto";
    audioByUser[userKey] = audio;
    lastSoundVersionByUser[userKey] = -1;
  }
  return audioByUser[userKey];
}

function pruneRemovedUsers(currentUserKeys) {
  Object.keys(audioByUser).forEach((userKey) => {
    if (!currentUserKeys.includes(userKey)) {
      delete audioByUser[userKey];
      delete lastSoundVersionByUser[userKey];
      delete previousServingByUser[userKey];
    }
  });
}

async function loadState() {
  const response = await fetch("/api/state");
  if (!response.ok) {
    return;
  }

  const state = await response.json();
  const userEntries = Object.entries(state.users);
  const cards = userEntries.map(([, user]) => userCard(user)).join("");

  peopleContainer.innerHTML = cards;
  applyDisplayLayout(userEntries.length);

  const currentUserKeys = userEntries.map(([userKey]) => userKey);
  pruneRemovedUsers(currentUserKeys);

  await syncSound(state.sound, currentUserKeys);
  playOnQueueAdvance(state);
}

async function syncSound(soundState, userKeys) {
  soundEnabled = Boolean(soundState?.enabled);

  for (const userKey of userKeys) {
    const userSoundMeta = soundState?.users?.[userKey];
    const audio = ensureAudio(userKey);
    if (!userSoundMeta?.configured) {
      audio.removeAttribute("src");
      lastSoundVersionByUser[userKey] = userSoundMeta?.version ?? -1;
      continue;
    }

    if (userSoundMeta.version === lastSoundVersionByUser[userKey]) {
      continue;
    }

    const response = await fetch(`/api/sound/${userKey}`);
    if (!response.ok) {
      continue;
    }

    const sound = await response.json();
    audio.src = sound.dataUrl;
    lastSoundVersionByUser[userKey] = sound.version;
  }
}

function playOnQueueAdvance(state) {
  const currentQueueNumber = state.queueNumber;
  const currentServingByUser = Object.fromEntries(
    Object.entries(state.users).map(([key, user]) => [key, user.servingNumber])
  );

  if (lastQueueNumber === null) {
    lastQueueNumber = currentQueueNumber;
    previousServingByUser = currentServingByUser;
    return;
  }

  if (currentQueueNumber > lastQueueNumber && soundEnabled) {
    const advancedUserKey = Object.keys(currentServingByUser).find(
      (key) => currentServingByUser[key] > (previousServingByUser[key] ?? 0)
    );
    const audio = advancedUserKey ? audioByUser[advancedUserKey] : null;
    if (audio?.src) {
      audio.currentTime = 0;
      audio.play().catch(() => {});
    }
  }

  lastQueueNumber = currentQueueNumber;
  previousServingByUser = currentServingByUser;
}

loadState();
setInterval(loadState, 2000);
window.addEventListener("resize", () => {
  applyDisplayLayout(peopleContainer?.children?.length || 1);
});
