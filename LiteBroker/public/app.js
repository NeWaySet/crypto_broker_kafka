const els = {
  auth: document.querySelector("#auth"),
  chat: document.querySelector("#chat"),
  crypto: document.querySelector("#crypto-view"),
  loginTab: document.querySelector("#login-tab"),
  registerTab: document.querySelector("#register-tab"),
  authForm: document.querySelector("#auth-form"),
  displayName: document.querySelector("#display-name"),
  username: document.querySelector("#username"),
  password: document.querySelector("#password"),
  authSubmit: document.querySelector("#auth-submit"),
  authError: document.querySelector("#auth-error"),
  sessionLabel: document.querySelector("#session-label"),
  messages: document.querySelector("#messages"),
  messageForm: document.querySelector("#message-form"),
  messageText: document.querySelector("#message-text"),
  containerView: document.querySelector("#container-view"),
};

let mode = "login";
let token = localStorage.getItem("lightCryptoChat.token") || "";
let me = null;

function setMode(nextMode) {
  mode = nextMode;
  els.loginTab.classList.toggle("active", mode === "login");
  els.registerTab.classList.toggle("active", mode === "register");
  els.displayName.hidden = mode === "login";
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
  els.chat.hidden = false;
  els.crypto.hidden = false;
  els.sessionLabel.textContent = `${user.displayName} ${user.username}`;
}

function render(messages) {
  els.messages.innerHTML = "";
  for (const message of messages) {
    const item = document.createElement("article");
    item.className = `message ${message.senderId === me.id ? "own" : ""}`;
    item.innerHTML = `<strong></strong><p></p><small></small>`;
    item.querySelector("strong").textContent = message.senderName;
    item.querySelector("p").textContent = message.text;
    item.querySelector("small").textContent = new Date(message.createdAt).toLocaleString();
    item.addEventListener("click", () => {
      els.containerView.textContent = JSON.stringify(message.cryptoContainer, null, 2);
    });
    els.messages.append(item);
  }
  const last = messages.at(-1);
  if (last) els.containerView.textContent = JSON.stringify(last.cryptoContainer, null, 2);
  els.messages.scrollTop = els.messages.scrollHeight;
}

async function loadMessages() {
  if (!token) return;
  const data = await request("/api/messages");
  showApp(data.user);
  render(data.messages);
}

els.loginTab.addEventListener("click", () => setMode("login"));
els.registerTab.addEventListener("click", () => setMode("register"));

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
    localStorage.setItem("lightCryptoChat.token", token);
    showApp(data.user);
    await loadMessages();
  } catch (error) {
    els.authError.textContent = error.message;
  }
});

els.messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.messageText.value.trim();
  if (!text) return;
  const data = await request("/api/messages", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
  els.messageText.value = "";
  els.containerView.textContent = JSON.stringify(data.message.cryptoContainer, null, 2);
  await loadMessages();
});

setMode("login");
if (token) void loadMessages().catch(() => localStorage.removeItem("lightCryptoChat.token"));
setInterval(() => void loadMessages().catch(() => undefined), 2500);
