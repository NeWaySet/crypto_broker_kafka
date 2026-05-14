import { Moon, Sun } from "lucide-react";
import { demoAvatars } from "../data/mockData";
import type { DemoProfile, Settings } from "../types";
import { useState } from "react";
import { Avatar } from "./Avatar";

interface DemoLoginProps {
  settings: Settings;
  onSettingsChange: (settings: Settings) => void;
  onLogin: (profile: DemoProfile) => void;
}

export function DemoLogin({ settings, onSettingsChange, onLogin }: DemoLoginProps) {
  const [name, setName] = useState("Студент");
  const [avatar, setAvatar] = useState(demoAvatars[0]);

  function login() {
    onLogin({
      id: "me",
      name: name.trim() || "Студент",
      username: "@demo_user",
      avatar,
    });
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark">AC</div>
        <h1>AeroChat</h1>
        <p>Локальный безопасный демо-мессенджер. Без номеров телефона, кодов входа и реальных аккаунтов.</p>

        <label className="field">
          Ваше имя
          <input value={name} onChange={(event) => setName(event.target.value)} maxLength={40} />
        </label>

        <div className="avatar-grid" aria-label="Выбор аватара">
          {demoAvatars.map((item) => (
            <button key={item} type="button" className={item === avatar ? "avatar-choice active" : "avatar-choice"} onClick={() => setAvatar(item)} aria-label={`Выбрать аватар ${item}`}>
              <Avatar label={item} />
            </button>
          ))}
        </div>

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
          <button type="button" className="primary-button" onClick={login}>
            Войти в демо
          </button>
        </div>
      </section>
    </main>
  );
}
