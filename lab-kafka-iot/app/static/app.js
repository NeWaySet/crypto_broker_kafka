const statusEl = document.querySelector("#status");
const messagesEl = document.querySelector("#messages");
const sensorsEl = document.querySelector("#sensors");
const summaryEl = document.querySelector("#sensor-summary");
const messageForm = document.querySelector("#message-form");
const senderInput = messageForm.querySelector("[name='sender']");

senderInput.value = localStorage.getItem("secureMessenger.sender") || senderInput.value;

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "request failed");
  }
  return data;
}

messageForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const sender = String(form.get("sender") || "student").trim() || "student";
  const message = String(form.get("message") || "").trim();
  if (!message) {
    return;
  }

  localStorage.setItem("secureMessenger.sender", sender);
  await postJson("/api/messages", { sender, message });
  event.currentTarget.querySelector("[name='message']").value = "";
  await refresh();
});

function renderMessages(items) {
  if (!items.length) {
    messagesEl.innerHTML = "<p class=\"empty\">Сообщений пока нет</p>";
    return;
  }

  const currentSender = senderInput.value.trim() || "student";
  messagesEl.innerHTML = [...items].reverse().map((item) => {
    const sender = item.sender || "unknown";
    const ownClass = sender === currentSender ? " own" : "";
    return `
      <article class="bubble${ownClass}">
        <div class="bubble-meta">
          <strong>${escapeHtml(sender)}</strong>
          <span>${formatTime(item.timestamp)}</span>
        </div>
        <p>${escapeHtml(item.message || item.text || "")}</p>
      </article>
    `;
  }).join("");
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function renderSensors(items) {
  if (!items.length) {
    sensorsEl.innerHTML = "<p class=\"empty\">Генератор еще не прислал данные</p>";
    summaryEl.innerHTML = "<span>-- °C</span><span>-- %</span>";
    return;
  }

  const latest = items[0];
  summaryEl.innerHTML = `
    <span>${Number(latest.temperature).toFixed(1)} °C</span>
    <span>${Number(latest.humidity).toFixed(1)} %</span>
  `;

  sensorsEl.innerHTML = items.slice(0, 8).map((item) => `
    <article class="sensor-row">
      <strong>${escapeHtml(item.sensor_id || "sensor")}</strong>
      <span>${Number(item.temperature).toFixed(1)} °C</span>
      <span>${Number(item.humidity).toFixed(1)} %</span>
      <small>${formatTime(item.timestamp)}</small>
    </article>
  `).join("");
}

function formatTime(value) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

async function refresh() {
  try {
    const response = await fetch("/api/state");
    const state = await response.json();
    renderMessages(state.messages || []);
    renderSensors(state.sensors || []);
    statusEl.textContent = "online";
    statusEl.classList.add("online");
  } catch (error) {
    statusEl.textContent = "offline";
    statusEl.classList.remove("online");
  }
}

refresh();
setInterval(refresh, 1500);
