const reactions = ["👍", "❤️", "😂", "😮", "🔥", "😢"];

interface ReactionPickerProps {
  onReact: (emoji: string) => void;
}

export function ReactionPicker({ onReact }: ReactionPickerProps) {
  return (
    <div className="reaction-picker" aria-label="Реакции">
      {reactions.map((emoji) => (
        <button type="button" key={emoji} aria-label={`Реакция ${emoji}`} onClick={() => onReact(emoji)}>
          {emoji}
        </button>
      ))}
    </div>
  );
}
