const peopleContainer = document.getElementById("people");
const pageStatus = document.getElementById("pageStatus");
const privatoTitle = document.getElementById("privatoTitle");

const urlParams = new URLSearchParams(window.location.search);
const userKey = String(urlParams.get("user") || "").trim().toLowerCase();

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
  if (!userKey) {
    pageStatus.textContent = "Parametro mancante: usa ?user=chiave-collega";
    return;
  }

  const response = await fetch("/api/state");
  if (!response.ok) {
    pageStatus.textContent = "Errore nel caricamento stato";
    return;
  }

  const state = await response.json();
  const user = state.users[userKey];
  if (!user) {
    peopleContainer.innerHTML = "";
    pageStatus.textContent = "Collega non trovato";
    return;
  }

  privatoTitle.textContent = `Gestione collega: ${user.name}`;
  peopleContainer.innerHTML = userCard(user);
  pageStatus.textContent = `Coda globale attuale: ${state.queueNumber}`;
}

async function post(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined
  });

  await loadState();
  if (!response.ok) {
    pageStatus.textContent = "Operazione non riuscita";
  }
}

document.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-action]");
  if (!button || !userKey) {
    return;
  }

  const action = button.dataset.action;
  if (action === "status") {
    await post(`/api/users/${userKey}/status`, { status: button.dataset.status });
    return;
  }

  if (action === "increment") {
    await post(`/api/users/${userKey}/increment`);
    return;
  }

  if (action === "decrement") {
    await post(`/api/users/${userKey}/decrement`);
  }
});

loadState();
setInterval(loadState, 3000);
