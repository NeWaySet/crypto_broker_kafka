const els = {
  auth: document.querySelector("#auth"),
  app: document.querySelector("#app"),
  loginTab: document.querySelector("#login-tab"),
  registerTab: document.querySelector("#register-tab"),
  authForm: document.querySelector("#auth-form"),
  displayNameWrap: document.querySelector("#display-name-wrap"),
  displayName: document.querySelector("#display-name"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  authSubmit: document.querySelector("#auth-submit"),
  authError: document.querySelector("#auth-error"),
  sessionLabel: document.querySelector("#session-label"),
  logout: document.querySelector("#logout"),
  selectUserButton: document.querySelector("#select-user-button"),
  userPopover: document.querySelector("#user-popover"),
  users: document.querySelector("#users"),
  userSearch: document.querySelector("#user-search"),
  chatTitle: document.querySelector("#chat-title"),
  chatTopic: document.querySelector("#chat-topic"),
  serverStatus: document.querySelector("#server-status"),
  emptyState: document.querySelector("#empty-state"),
  messages: document.querySelector("#messages"),
  messageForm: document.querySelector("#message-form"),
  messageText: document.querySelector("#message-text"),
  sendButton: document.querySelector("#send-button"),
  containerView: document.querySelector("#container-view"),
  sensorTopic: document.querySelector("#sensor-topic"),
  sensorList: document.querySelector("#sensor-list"),
};

let mode = "login";
let token = localStorage.getItem("litebroker.token") || "";
let me = null;
let users = [];
let selectedPeer = null;
let messages = [];

function setMode(nextMode) {
  mode = nextMode;
  els.loginTab.classList.toggle("active", mode === "login");
  els.registerTab.classList.toggle("active", mode === "register");
  els.displayNameWrap.hidden = mode === "login";
  els.authSubmit.textContent = mode === "login" ? "Войти" : "Создать аккаунт";
  els.authError.textContent = "";
}

async function request(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Ошибка запроса");
  return data;
}

function showApp(user) {
  me = user;
  els.auth.hidden = true;
  els.app.hidden = false;
  els.sessionLabel.textContent = `${user.displayName} ${user.username}`;
}

function logout() {
  token = "";
  me = null;
  selectedPeer = null;
  localStorage.removeItem("litebroker.token");
  els.app.hidden = true;
  els.auth.hidden = false;
}

function renderUsers() {
  const query = els.userSearch.value.trim().toLowerCase();
  const filtered = users.filter((user) => {
    const haystack = `${user.displayName} ${user.username}`.toLowerCase();
    return !query || haystack.includes(query);
  });

  els.users.innerHTML = "";
  if (!filtered.length) {
    els.users.innerHTML = `<div class="empty-mini">Пользователь не найден</div>`;
    return;
  }

  for (const user of filtered) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `user-item ${selectedPeer?.id === user.id ? "active" : ""}`;
    button.innerHTML = `
      <span class="avatar">${initials(user.displayName)}</span>
      <span>
        <strong></strong>
        <small></small>
      </span>
    `;
    button.querySelector("strong").textContent = user.displayName;
    button.querySelector("small").textContent = user.username;
    button.addEventListener("click", () => {
      selectPeer(user);
      els.userPopover.hidden = true;
    });
    els.users.append(button);
  }
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join("");
}

async function selectPeer(user) {
  selectedPeer = user;
  els.chatTitle.textContent = user.username.replace(/^@/, "");
  els.chatTopic.textContent = "загрузка топика...";
  els.messageText.disabled = false;
  els.sendButton.disabled = false;
  renderUsers();
  await loadMessages();
  els.messageText.focus();
}

function renderMessages() {
  els.messages.innerHTML = "";
  els.emptyState.hidden = Boolean(selectedPeer);
  els.messages.hidden = !selectedPeer;

  if (selectedPeer && !messages.length) {
    els.messages.innerHTML = `<div class="empty-state inline"><h3>Сообщений пока нет</h3><p>Отправьте первое сообщение в защищенный Kafka-топик.</p></div>`;
    els.containerView.innerHTML = "";
    return;
  }

  for (const message of messages) {
    const own = message.senderId === me.id;
    const item = document.createElement("article");
    item.className = `message ${own ? "own" : ""}`;
    item.innerHTML = `
      <p></p>
      <footer><span class="msg-time"></span><span class="msg-method"></span></footer>
    `;
    item.querySelector("p").textContent = message.text;
    item.querySelector(".msg-time").textContent = new Date(message.createdAt).toLocaleString([], {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    item.querySelector(".msg-method").textContent = message.cryptoContainer.algorithm;
    item.addEventListener("click", () => {
      highlightContainer(message.id);
    });
    els.messages.append(item);
  }

  const last = messages.at(-1);
  renderCryptoFeed(messages, last?.id);
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderCryptoFeed(items, activeId = "") {
  els.containerView.innerHTML = "";
  for (const message of items.slice().reverse()) {
    const card = document.createElement("article");
    card.className = `container-card ${message.id === activeId ? "active" : ""}`;
    card.dataset.messageId = message.id;
    card.innerHTML = `
      <header>
        <strong></strong>
        <span></span>
      </header>
      <pre></pre>
    `;
    card.querySelector("strong").textContent = message.text || "[пусто]";
    card.querySelector("span").textContent = new Date(message.createdAt).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    card.querySelector("pre").textContent = JSON.stringify(message.cryptoContainer, null, 2);
    card.addEventListener("click", () => highlightContainer(message.id));
    els.containerView.append(card);
  }
}

function highlightContainer(messageId) {
  const cards = els.containerView.querySelectorAll(".container-card");
  cards.forEach((card) => card.classList.toggle("active", card.dataset.messageId === messageId));
  const active = els.containerView.querySelector(`.container-card[data-message-id="${CSS.escape(messageId)}"]`);
  active?.scrollIntoView({ block: "nearest" });
}

function renderSensors(data) {
  els.sensorTopic.textContent = data.topic;
  const samples = data.samples.slice(-5).reverse();
  els.sensorList.innerHTML = samples
    .map(
      (sample) => `
        <div class="sensor-row">
          <strong>${sample.temperature.toFixed(1)} °C</strong>
          <span>${sample.humidity.toFixed(1)} %</span>
          <span>${sample.pressure.toFixed(1)} hPa</span>
          <small>${new Date(sample.created_at).toLocaleTimeString()}</small>
        </div>
      `,
    )
    .join("");
}

async function loadUsers() {
  const data = await request("/api/users");
  users = data.users;
  renderUsers();
}

async function loadMessages() {
  if (!token || !selectedPeer) return;
  const data = await request(`/api/messages?peerId=${encodeURIComponent(selectedPeer.id)}`);
  showApp(data.user);
  messages = data.messages;
  const topic = messages[0]?.chatTopic || `litebroker.chat.${[me.username.slice(1), selectedPeer.username.slice(1)].sort().join("__")}`;
  els.chatTopic.textContent = topic;
  renderMessages();
}

async function loadSensors() {
  if (!token) return;
  const data = await request("/api/sensors");
  renderSensors(data);
}

async function health() {
  try {
    const data = await request("/api/health");
    els.serverStatus.textContent = data.kafka.ready ? "Kafka подключена" : "Kafka недоступна, запись локально";
    els.serverStatus.classList.toggle("warn", !data.kafka.ready);
  } catch {
    els.serverStatus.textContent = "сервер недоступен";
    els.serverStatus.classList.add("warn");
  }
}

els.loginTab.addEventListener("click", () => setMode("login"));
els.registerTab.addEventListener("click", () => setMode("register"));
els.logout.addEventListener("click", logout);
els.selectUserButton.addEventListener("click", () => {
  els.userPopover.hidden = !els.userPopover.hidden;
});
els.userSearch.addEventListener("input", renderUsers);

els.authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.authError.textContent = "";
  try {
    const data = await request(`/api/auth/${mode === "login" ? "login" : "register"}`, {
      method: "POST",
      body: JSON.stringify({
        displayName: els.displayName.value,
        username: els.username.value,
        password: els.password.value,
      }),
    });
    token = data.token;
    localStorage.setItem("litebroker.token", token);
    showApp(data.user);
    await Promise.all([loadUsers(), loadSensors(), health()]);
  } catch (error) {
    els.authError.textContent = error.message;
  }
});

els.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedPeer) return;
  const text = els.messageText.value.trim();
  if (!text) return;
  els.sendButton.disabled = true;
  try {
    const data = await request("/api/messages", {
      method: "POST",
      body: JSON.stringify({ text, recipientId: selectedPeer.id }),
    });
    els.messageText.value = "";
    els.containerView.textContent = JSON.stringify(data.message.cryptoContainer, null, 2);
    await loadMessages();
  } finally {
    els.sendButton.disabled = false;
  }
});

setMode("login");
if (token) {
  Promise.all([request("/api/messages").then((data) => showApp(data.user)), loadUsers(), loadSensors(), health()]).catch(logout);
}

setInterval(() => {
  void health();
  void loadSensors().catch(() => undefined);
  if (selectedPeer) void loadMessages().catch(() => undefined);
}, 3000);
