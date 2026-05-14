import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import { demoAvatars } from "../data/mockData";
import type { DemoProfile, Settings } from "../types";
import { Avatar } from "./Avatar";

interface DemoLoginProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onLogin: (username: string, password: string) => string | null;
  onRegister: (input: { name: string; username: string; password: string; avatar: string }) => string | null;
}

export function DemoLogin({ settings, onSettingsChange, onLogin, onRegister }: DemoLoginProps) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState(demoAvatars[0]);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const result =
      mode === "login"
        ? onLogin(username, password)
        : onRegister({ name, username, password, avatar });
    setError(result || "");
  }

  return (
    <main className="login-screen">
      <form className="login-panel" onSubmit={submit}>
        <div className="brand-mark">AC</div>
        <h1>AeroChat</h1>
        <p>Локальный демо-мессенджер с регистрацией по username и паролю. Данные сохраняются в локальной БД браузера.</p>

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
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="andrey_01" autoComplete="username" />
        </label>

        <label className="field">
          Пароль
          <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="минимум 4 символа" autoComplete={mode === "login" ? "current-password" : "new-password"} />
        </label>

        {mode === "register" && (
          <div className="avatar-grid" aria-label="Выбор аватара">
            {demoAvatars.map((item) => (
              <button key={item} type="button" className={item === avatar ? "avatar-choice active" : "avatar-choice"} onClick={() => setAvatar(item)} aria-label={`Выбрать аватар ${item}`}>
                <Avatar label={item} />
              </button>
            ))}
          </div>
        )}

        {error && <div className="form-error" role="alert">{error}</div>}

        <div className="login-row">
          <button
            type="button"
            className="secondary-button"
            onClick={() => onSettingsChange({ ...settings, theme: settings.theme === "dark" ? "light" : "dark" })}
            aria-label="Переключить тему"
          >
            {settings.theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}
            {settings.theme === "dark" ? "Светлая" : "Темная"}
          </button>
          <button type="submit" className="primary-button">
            {mode === "login" ? "Войти" : "Создать аккаунт"}
          </button>
        </div>
      </form>
    </main>
  );
}
