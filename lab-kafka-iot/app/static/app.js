const statusEl = document.querySelector("#status");
const messagesEl = document.querySelector("#messages");
const sensorsEl = document.querySelector("#sensors");

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

document.querySelector("#message-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await postJson("/api/messages", {
    sender: form.get("sender"),
    message: form.get("message"),
  });
  event.currentTarget.message.value = "";
});

document.querySelector("#sensor-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  await postJson("/api/sensors", {
    sensor_id: form.get("sensor_id"),
    temperature: form.get("temperature"),
    humidity: form.get("humidity"),
  });
});

function renderMessages(items) {
  messagesEl.innerHTML = items.map((item) => `
    <article class="item">
      <strong>${escapeHtml(item.sender || "unknown")}</strong>
      <p>${escapeHtml(item.message || item.text || "")}</p>
      <small>${escapeHtml(item.timestamp || "")} · ${escapeHtml(item.validation_result || "")}</small>
    </article>
  `).join("") || "<p class=\"empty\">Пока нет сообщений</p>";
}

function renderSensors(items) {
  sensorsEl.innerHTML = items.map((item) => `
    <article class="item sensor">
      <strong>${escapeHtml(item.sensor_id || "sensor")}</strong>
      <p>${Number(item.temperature).toFixed(1)} °C · ${Number(item.humidity).toFixed(1)} %</p>
      <small>${escapeHtml(item.timestamp || "")} · ${escapeHtml(item.validation_result || "")}</small>
    </article>
  `).join("") || "<p class=\"empty\">Пока нет данных</p>";
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
