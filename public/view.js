const peopleContainer = document.getElementById("people");
const audioByUser = {
  ivan: new Audio(),
  antonio: new Audio()
};
Object.values(audioByUser).forEach((audio) => {
  audio.preload = "auto";
});

let lastQueueNumber = null;
let soundEnabled = true;
let previousServingByUser = {};
const lastSoundVersionByUser = {
  ivan: -1,
  antonio: -1
};

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

async function loadState() {
  const response = await fetch("/api/state");
  if (!response.ok) {
    return;
  }

  const state = await response.json();
  const cards = Object.values(state.users)
    .map((user) => userCard(user))
    .join("");

  peopleContainer.innerHTML = cards;

  await syncSound(state.sound);
  playOnQueueAdvance(state);
}

async function syncSound(soundState) {
  soundEnabled = Boolean(soundState?.enabled);

  for (const userKey of Object.keys(audioByUser)) {
    const userSoundMeta = soundState?.users?.[userKey];
    const audio = audioByUser[userKey];
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
