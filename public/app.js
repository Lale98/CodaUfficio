const peopleContainer = document.getElementById("people");
const soundFileIvanInput = document.getElementById("soundFileIvan");
const soundFileAntonioInput = document.getElementById("soundFileAntonio");
const soundStatusIvan = document.getElementById("soundStatusIvan");
const soundStatusAntonio = document.getElementById("soundStatusAntonio");
const soundStatusGlobal = document.getElementById("soundStatusGlobal");

function getSoundFileInput(userKey) {
  return userKey === "ivan" ? soundFileIvanInput : soundFileAntonioInput;
}

function getSoundStatusElement(userKey) {
  return userKey === "ivan" ? soundStatusIvan : soundStatusAntonio;
}

function userCard(user) {
  const isFree = user.status === "libero";
  return `
    <article class="person">
      <div class="person-name-row">
        <span class="dot ${isFree ? "free" : "busy"}"></span>
        <div class="person-name">${user.name}</div>
      </div>
      <div class="queue-text">serviamo il numero ${user.servingNumber}</div>
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
  if (soundStatusGlobal) {
    const enabled = state.sound?.enabled ? "attiva" : "disattivata";
    soundStatusGlobal.textContent = `Riproduzione audio ${enabled}`;
  }

  if (soundStatusIvan) {
    const configuredIvan = state.sound?.users?.ivan?.configured
      ? "configurato"
      : "non configurato";
    soundStatusIvan.textContent = `Ivan: suono ${configuredIvan}`;
  }

  if (soundStatusAntonio) {
    const configuredAntonio = state.sound?.users?.antonio?.configured
      ? "configurato"
      : "non configurato";
    soundStatusAntonio.textContent = `Antonio: suono ${configuredAntonio}`;
  }
}

async function post(url, body) {
  await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  await loadState();
}

async function removeSound(userKey) {
  await fetch(`/api/sound/${userKey}`, { method: "DELETE" });
  await loadState();
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Lettura file fallita"));
    reader.readAsDataURL(file);
  });
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  if (action === "status") {
    await post(`/api/users/${button.dataset.name}/status`, {
      status: button.dataset.status
    });
    return;
  }

  if (action === "increment") {
    await post(`/api/users/${button.dataset.name}/increment`);
    return;
  }

  if (action === "decrement") {
    await post(`/api/users/${button.dataset.name}/decrement`);
    return;
  }

  if (action === "queue-reset") {
    await post("/api/queue/reset");
    return;
  }

  if (action === "sound-upload") {
    const userKey = String(button.dataset.name || "");
    const fileInput = getSoundFileInput(userKey);
    const statusElement = getSoundStatusElement(userKey);
    const file = fileInput?.files?.[0];
    if (!file) {
      if (statusElement) {
        statusElement.textContent = `Seleziona prima un file MP3 per ${userKey}`;
      }
      return;
    }

    if (!(file.type === "audio/mpeg" || file.name.toLowerCase().endsWith(".mp3"))) {
      if (statusElement) {
        statusElement.textContent = "Formato non valido: usa un file .mp3";
      }
      return;
    }

    const dataUrl = await readFileAsDataUrl(file);
    await post(`/api/sound/${userKey}`, { dataUrl });
    if (statusElement) {
      statusElement.textContent = `Suono caricato con successo per ${userKey}`;
    }
    return;
  }

  if (action === "sound-clear") {
    const userKey = String(button.dataset.name || "");
    const statusElement = getSoundStatusElement(userKey);
    await removeSound(userKey);
    if (statusElement) {
      statusElement.textContent = `Suono rimosso per ${userKey}`;
    }
    return;
  }

  if (action === "sound-enable") {
    await post("/api/sound/enabled", { enabled: true });
    return;
  }

  if (action === "sound-disable") {
    await post("/api/sound/enabled", { enabled: false });
  }
});

loadState();
setInterval(loadState, 3000);
