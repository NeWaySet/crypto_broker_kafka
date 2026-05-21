import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { avatars } from "../data/mockData";
import type { Settings } from "../types";

interface AuthScreenProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (input: { name: string; username: string; password: string; avatar: string }) => Promise<string | null>;
}

export function AuthScreen({ settings, onSettingsChange, onLogin, onRegister }: AuthScreenProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const result =
      mode === "login"
        ? await onLogin(username, password)
        : await onRegister({ name, username, password, avatar: avatars[0] });
    setBusy(false);
    if (result) setError(result);
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <h1>CryptoBroker</h1>
        <p>Вход в мессенджер. Аккаунты, чаты и сообщения хранятся на локальном сервере приложения.</p>

        <div className="auth-tabs" role="tablist" aria-label="Режим авторизации">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
            Вход
          </button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
            Регистрация
          </button>
        </div>

        {mode === "register" && (
          <label className="field">
            Имя
            <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} placeholder="Например, Андрей" autoComplete="name" />
          </label>
        )}

        <label className="field">
          <span className="sr-only">Username</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="" autoComplete="off" />
        </label>

        <label className="field">
          <span className="sr-only">Пароль</span>
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="" autoComplete="off" />
        </label>

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="login-row">
          <button
            className="secondary-button"
            type="button"
            onClick={() => onSettingsChange({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })}
            aria-label="Переключить тему"
          >
            {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {settings.theme === "dark" ? "Светлая" : "Темная"}
          </button>
          <button className="primary-button" type="submit" disabled={busy}>
            {busy ? "Подождите..." : mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </div>
      </form>
    </main>
  );
}
