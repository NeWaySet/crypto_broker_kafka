const emojis = ["😀", "😄", "😂", "😊", "😍", "😎", "🤔", "😮", "😢", "👍", "❤️", "🔥", "✨", "🎉", "✅", "🚀", "💡", "📌", "📎", "☕", "🌙", "⭐", "🧩", "🔐"];

interface EmojiPickerProps {
  onPick: (emoji: string) => void;
}

export function EmojiPicker({ onPick }: EmojiPickerProps) {
  return (
    <div className="emoji-picker" aria-label="Панель эмодзи">
      {emojis.map((emoji) => (
        <button type="button" key={emoji} aria-label={`Добавить ${emoji}`} onClick={() => onPick(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
