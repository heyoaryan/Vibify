import { useCallback, useEffect, useRef, useState } from 'react';

export function SeekSlider({
  value,
  max,
  onSeek,
  ariaLabel,
}: {
  value: number;
  max: number;
  onSeek: (v: number) => void;
  ariaLabel: string;
}) {
  const [dragValue, setDragValue] = useState<number | null>(null);
  const seekTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const displayed = dragValue ?? value;
  const pct = max > 0 ? (displayed / max) * 100 : 0;

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value);
      setDragValue(v);
      if (seekTimeout.current) clearTimeout(seekTimeout.current);
      seekTimeout.current = setTimeout(() => onSeek(v), 60);
    },
    [onSeek],
  );

  // Commit seek on pointer/mouse/touch end — covers all platforms:
  // - onPointerUp: modern browsers (Chrome, Firefox, Safari 13.1+)
  // - onMouseUp: older Safari desktop fallback
  // - onTouchEnd: Android / iOS when pointer events are absent
  const commitSeek = useCallback(() => {
    if (seekTimeout.current) clearTimeout(seekTimeout.current);
    if (dragValue != null) onSeek(dragValue);
    setDragValue(null);
  }, [dragValue, onSeek]);

  const cancelSeek = useCallback(() => {
    if (seekTimeout.current) clearTimeout(seekTimeout.current);
    setDragValue(null);
  }, []);

  useEffect(() => () => { if (seekTimeout.current) clearTimeout(seekTimeout.current); }, []);

  return (
    // py-3 gives a 44px-tall tap region even though the visible bar is 4px
    <div className="group relative flex items-center py-3">
      {/* Native range input — invisible but handles all pointer/touch events */}
      <input
        type="range"
        min={0}
        max={max || 1}
        step={0.1}
        value={displayed}
        aria-label={ariaLabel}
        onChange={handleChange}
        onPointerUp={commitSeek}
        onMouseUp={commitSeek}
        onTouchEnd={commitSeek}
        onPointerCancel={cancelSeek}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        style={{ touchAction: 'none' }}
      />

      {/* Visual track */}
      <div className="pointer-events-none relative h-1 w-full overflow-hidden rounded-full transition-all duration-150 group-hover:h-[5px]">
        <div className="absolute inset-0 rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-0 h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: 'linear-gradient(to right, #14c4ad, #0ea5e9)',
          }}
        />
      </div>

      {/* Thumb dot — visible on hover/drag */}
      <div
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}

export function VolumeSlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const pct = value * 100;

  return (
    // py-3 → 44px touch target height
    <div className="group relative flex w-24 items-center py-3">
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={value}
        aria-label="Volume"
        onChange={(e) => onChange(Number(e.target.value))}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
        style={{ touchAction: 'none' }}
      />

      {/* Visual track */}
      <div className="pointer-events-none relative h-1 w-full overflow-hidden rounded-full transition-all duration-150 group-hover:h-[5px]">
        <div className="absolute inset-0 rounded-full bg-white/10" />
        <div
          className="absolute left-0 top-0 h-full rounded-full bg-white/80"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Thumb dot */}
      <div
        className="pointer-events-none absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white opacity-0 shadow transition-opacity group-hover:opacity-100"
        style={{ left: `${pct}%` }}
      />
    </div>
  );
}
