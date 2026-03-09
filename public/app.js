const peopleContainer = document.getElementById("people");
const usersControlsContainer = document.getElementById("usersControls");
const newColleagueNameInput = document.getElementById("newColleagueName");
const newColleagueStatus = document.getElementById("newColleagueStatus");
const soundStatusGlobal = document.getElementById("soundStatusGlobal");

const perUserStatusMessage = {};

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

function userControls(userKey, user, soundMeta) {
  const configured = soundMeta?.configured ? "configurato" : "non configurato";
  const message = perUserStatusMessage[userKey] || "";
  return `
    <article class="user-control-card">
      <h3>${user.name}</h3>
      <p class="mini-link">
        Schermata collega:
        <a href="/privato.html?user=${encodeURIComponent(userKey)}" target="_blank" rel="noopener">
          apri ${user.name}
        </a>
      </p>
      <div class="row">
        <button data-action="status" data-name="${userKey}" data-status="libero">Libero</button>
        <button data-action="status" data-name="${userKey}" data-status="occupato">Occupato</button>
        <button data-action="increment" data-name="${userKey}">Avanza</button>
        <button data-action="decrement" data-name="${userKey}">-1</button>
        <button data-action="remove-user" data-name="${userKey}">Rimuovi collega</button>
      </div>
      <div class="row">
        <input id="sound-file-${userKey}" type="file" accept=".mp3,audio/mpeg" />
        <button data-action="sound-upload" data-name="${userKey}">Carica MP3</button>
        <button data-action="sound-clear" data-name="${userKey}">Rimuovi suono</button>
      </div>
      <p id="sound-status-${userKey}">${user.name}: suono ${configured}</p>
      <p id="status-message-${userKey}" class="muted-row">${message}</p>
    </article>
  `;
}

async function loadState() {
  const response = await fetch("/api/state");
  if (!response.ok) {
    return;
  }

  const state = await response.json();
  const users = Object.entries(state.users);
  const cards = users.map(([, user]) => userCard(user)).join("");
  peopleContainer.innerHTML = cards;

  const controls = users
    .map(([userKey, user]) => userControls(userKey, user, state.sound?.users?.[userKey]))
    .join("");
  usersControlsContainer.innerHTML = controls;

  if (soundStatusGlobal) {
    const enabled = state.sound?.enabled ? "attiva" : "disattivata";
    soundStatusGlobal.textContent = `Riproduzione audio ${enabled}`;
  }
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });
  await loadState();
  return response;
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

function setUserMessage(userKey, message) {
  perUserStatusMessage[userKey] = message;
  const messageElement = document.getElementById(`status-message-${userKey}`);
  if (messageElement) {
    messageElement.textContent = message;
  }
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

  if (action === "add-user") {
    const name = String(newColleagueNameInput?.value || "").trim();
    if (!name) {
      if (newColleagueStatus) {
        newColleagueStatus.textContent = "Inserisci un nome collega";
      }
      return;
    }

    const response = await post("/api/users", { name });
    if (newColleagueStatus) {
      newColleagueStatus.textContent = response.ok
        ? `Collega "${name}" aggiunto`
        : "Impossibile aggiungere collega (nome gia usato o non valido)";
    }
    if (response.ok && newColleagueNameInput) {
      newColleagueNameInput.value = "";
    }
    return;
  }

  if (action === "remove-user") {
    const userKey = String(button.dataset.name || "");
    await fetch(`/api/users/${userKey}`, { method: "DELETE" });
    await loadState();
    return;
  }

  if (action === "sound-upload") {
    const userKey = String(button.dataset.name || "");
    const fileInput = document.getElementById(`sound-file-${userKey}`);
    const statusElement = document.getElementById(`sound-status-${userKey}`);
    const file = fileInput?.files?.[0];
    if (!file) {
      if (statusElement) {
        statusElement.textContent = "Seleziona prima un file MP3";
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
      statusElement.textContent = "Suono caricato con successo";
    }
    setUserMessage(userKey, "");
    return;
  }

  if (action === "sound-clear") {
    const userKey = String(button.dataset.name || "");
    const statusElement = document.getElementById(`sound-status-${userKey}`);
    await removeSound(userKey);
    if (statusElement) {
      statusElement.textContent = "Suono rimosso";
    }
    setUserMessage(userKey, "");
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
