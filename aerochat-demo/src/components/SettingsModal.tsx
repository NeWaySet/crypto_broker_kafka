import { LogOut } from "lucide-react";
import { demoAvatars } from "../data/mockData";
import type { DemoProfile, Settings } from "../types";
import { Avatar } from "./Avatar";
import { Modal } from "./Modal";

interface SettingsModalProps {
  profile: DemoProfile;
  settings: Settings;
  onProfileChange: (profile: DemoProfile) => void;
  onSettingsChange: (settings: Settings) => void;
  onClose: () => void;
  onLogout: () => void;
}

export function SettingsModal({ profile, settings, onProfileChange, onSettingsChange, onClose, onLogout }: SettingsModalProps) {
  return (
    <Modal title="Настройки AeroChat" onClose={onClose}>
      <div className="settings-grid">
        <section>
          <h3>Профиль</h3>
          <label className="field">
            Имя пользователя
            <input value={profile.name} onChange={(event) => onProfileChange({ ...profile, name: event.target.value })} />
          </label>
          <label className="field">
            Username
            <input value={profile.username} onChange={(event) => onProfileChange({ ...profile, username: event.target.value })} />
          </label>
          <div className="avatar-grid compact">
            {demoAvatars.map((avatar) => (
              <button key={avatar} type="button" className={avatar === profile.avatar ? "avatar-choice active" : "avatar-choice"} onClick={() => onProfileChange({ ...profile, avatar })} aria-label={`Выбрать аватар ${avatar}`}>
                <Avatar label={avatar} />
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3>Внешний вид</h3>
          <label className="field">
            Тема
            <select value={settings.theme} onChange={(event) => onSettingsChange({ ...settings, theme: event.target.value as Settings["theme"] })}>
              <option value="light">Светлая</option>
              <option value="dark">Темная</option>
              <option value="system">Системная</option>
            </select>
          </label>
          <label className="field">
            Цвет акцента
            <input type="color" value={settings.accentColor} onChange={(event) => onSettingsChange({ ...settings, accentColor: event.target.value })} />
          </label>
          <label className="field">
            Размер текста
            <select value={settings.fontSize} onChange={(event) => onSettingsChange({ ...settings, fontSize: event.target.value as Settings["fontSize"] })}>
              <option value="small">Маленький</option>
              <option value="normal">Обычный</option>
              <option value="large">Крупный</option>
            </select>
          </label>
          <label className="field">
            Фон чата
            <select value={settings.chatBackground} onChange={(event) => onSettingsChange({ ...settings, chatBackground: event.target.value })}>
              <option value="soft">Мягкий</option>
              <option value="plain">Однотонный</option>
              <option value="grid">Сетка</option>
            </select>
          </label>
        </section>

        <section>
          <h3>Приватность и уведомления</h3>
          <label className="check-row">
            <input type="checkbox" checked={settings.notificationsEnabled} onChange={(event) => onSettingsChange({ ...settings, notificationsEnabled: event.target.checked })} />
            Уведомления
          </label>
          <label className="check-row">
            <input type="checkbox" checked={settings.privacyMode} onChange={(event) => onSettingsChange({ ...settings, privacyMode: event.target.checked })} />
            Конфиденциальный режим
          </label>
          <label className="field">
            Язык
            <select value={settings.language} onChange={(event) => onSettingsChange({ ...settings, language: event.target.value as Settings["language"] })}>
              <option value="ru">Русский</option>
              <option value="en">English</option>
            </select>
          </label>
        </section>

        <section>
          <h3>Горячие клавиши</h3>
          <div className="shortcut-list">
            <span>Ctrl/Cmd + K</span><small>поиск</small>
            <span>Enter</span><small>отправить</small>
            <span>Shift + Enter</span><small>новая строка</small>
            <span>Escape</span><small>закрыть окно</small>
            <span>Ctrl/Cmd + E</span><small>редактировать выбранное</small>
          </div>
        </section>

        <section>
          <h3>Активные сессии</h3>
          <div className="session-list">
            <span>Windows Desktop · сейчас</span>
            <span>Demo Tablet · 12 минут назад</span>
            <span>Mobile Preview · вчера</span>
          </div>
          <button className="danger-button" type="button" onClick={onLogout}>
            <LogOut size={16} />
            Выйти из демо-аккаунта
          </button>
        </section>
      </div>
    </Modal>
  );
}
