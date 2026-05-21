import { LogOut } from "lucide-react";
import type { Profile, Settings } from "../types";
import { Modal } from "./Modal";

interface SettingsModalProps {
  profile: Profile;
  settings: Settings;
  onProfileChange: (profile: Profile) => void;
  onSettingsChange: (settings: Settings) => void;
  onClose: () => void;
  onLogout: () => void;
}

export function SettingsModal({
  profile,
  settings,
  onProfileChange,
  onSettingsChange,
  onClose,
  onLogout,
}: SettingsModalProps) {
  return (
    <Modal title="Настройки CryptoBroker" onClose={onClose}>
      <div className="settings-grid">
        <section>
          <h3>Профиль</h3>
          <label className="field">
            Имя пользователя
            <input value={profile.name} onChange={(event) => onProfileChange({ ...profile, name: event.target.value })} />
          </label>
          <label className="field">
            Username
            <input value={profile.username} readOnly />
          </label>
          <p className="field-note">Username используется для входа и поиска, поэтому изменять его можно только через серверную миграцию.</p>
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
              <option value="plain">Графитовый</option>
              <option value="grid">Сетка</option>
            </select>
          </label>
        </section>

        <section>
          <h3>Уведомления и приватность</h3>
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
            <span>Ctrl/Cmd + K</span><small>Поиск</small>
            <span>Enter</span><small>Отправить</small>
            <span>Shift + Enter</span><small>Новая строка</small>
            <span>Escape</span><small>Закрыть окно</small>
            <span>Ctrl/Cmd + E</span><small>Редактировать сообщение</small>
          </div>
        </section>

        <section>
          <h3>Сессии</h3>
          <div className="session-list">
            <span>Текущее устройство - активно</span>
          </div>
          <button className="danger-button" type="button" onClick={onLogout}>
            <LogOut size={16} />
            Выйти из аккаунта
          </button>
        </section>
      </div>
    </Modal>
  );
}
