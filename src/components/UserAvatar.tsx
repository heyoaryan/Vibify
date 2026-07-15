/**
 * UserAvatar — shows the user's Google profile picture if available,
 * otherwise falls back to the first letter of their name on a gradient background.
 *
 * Props:
 *   size   — pixel size (used for both width and height). Default: 32
 *   radius — Tailwind rounded class. Default: "rounded-full"
 */
import { useCurrentUser } from '../auth';

interface UserAvatarProps {
  size?: number;
  radius?: string;
  className?: string;
}

export function UserAvatar({ size = 32, radius = 'rounded-full', className = '' }: UserAvatarProps) {
  const user = useCurrentUser();
  const initial = user.name.charAt(0).toUpperCase() || 'G';

  if (user.avatar) {
    return (
      <img
        src={user.avatar}
        alt={user.name}
        referrerPolicy="no-referrer"
        width={size}
        height={size}
        className={`shrink-0 object-cover shadow-glow ${radius} ${className}`}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-label={user.name}
      className={`grid shrink-0 place-items-center bg-gradient-to-br from-brand-400 to-accent-500
        font-bold text-ink-950 shadow-glow ${radius} ${className}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initial}
    </span>
  );
}
