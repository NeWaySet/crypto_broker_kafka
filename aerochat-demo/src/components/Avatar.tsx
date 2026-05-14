interface AvatarProps {
  label: string;
  online?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}

export function Avatar({ label, online, size = "md" }: AvatarProps) {
  return (
    <span className={`avatar avatar-${size}`} aria-hidden="true">
      {label.slice(0, 2)}
      {online && <span className="online-dot" />}
    </span>
  );
}
