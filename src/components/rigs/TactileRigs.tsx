import {
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { DialControl, type JoystickValue } from '../../spatialkit';

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/**
 * Tactile Rotary Dial with 360° rotation, graduation ticks, and knurled metal styling.
 */
export function TactileDial({
  value,
  onChange,
  min = 0,
  max = 360,
  step = 1,
  size = 100,
  label = 'Dial',
  unit = '°',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  size?: number;
  label?: string;
  unit?: string;
}) {
  return (
    <div className="tactile-control-wrapper flex flex-col items-center">
      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-medium">
        {label}
      </div>
      <DialControl
        className="tactile-dial relative select-none cursor-grab active:cursor-grabbing"
        style={{ width: size, height: size }}
        min={min}
        max={max}
        step={step}
        minAngle={0}
        maxAngle={360}
        value={value}
        onChange={onChange}
        label={label}
        formatValue={(v) => `${Math.round(v)}${unit}`}
      >
        {({ progress, active }) => {
          const r = 40;
          const circumference = 2 * Math.PI * r;
          const rotationAngle = (value - min) / (max - min) * 360;

          return (
            <div
              className={`w-full h-full rounded-full flex items-center justify-center relative transition-shadow ${
                active ? 'shadow-[0_0_24px_rgba(56,189,248,0.4)]' : ''
              }`}
              style={{
                background: 'radial-gradient(circle, #1e293b 0%, #0f172a 100%)',
                border: '2px solid rgba(148, 163, 184, 0.2)',
              }}
            >
              {/* Outer SVG Track */}
              <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="#334155"
                  strokeWidth="4"
                  strokeDasharray={`${circumference} ${circumference}`}
                />
                <circle
                  cx="50"
                  cy="50"
                  r={r}
                  fill="none"
                  stroke="#38bdf8"
                  strokeWidth="5"
                  strokeDasharray={`${circumference} ${circumference}`}
                  strokeDashoffset={circumference * (1 - progress)}
                  strokeLinecap="round"
                  transform="rotate(-90 50 50)"
                />
              </svg>

              {/* Rotary Knob Face */}
              <div
                className="w-16 h-16 rounded-full bg-gradient-to-b from-slate-700 to-slate-900 border border-slate-600/50 shadow-inner flex items-center justify-center relative"
                style={{
                  transform: `rotate(${rotationAngle}deg)`,
                  boxShadow: 'inset 0 2px 4px rgba(255,255,255,0.1), 0 4px 10px rgba(0,0,0,0.5)',
                }}
              >
                {/* Pointer Pip */}
                <div className="absolute top-1 w-1.5 h-3 rounded-full bg-sky-400 shadow-[0_0_8px_#38bdf8]" />
                <div className="w-8 h-8 rounded-full border border-slate-600/40 bg-slate-800/80 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-slate-500" />
                </div>
              </div>
            </div>
          );
        }}
      </DialControl>
      <div className="mt-2 font-mono text-xs text-sky-400 font-semibold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">
        {Math.round(value)}{unit}
      </div>
    </div>
  );
}

/**
 * Mechanical Vertical Pull Lever with Knurled T-Bar Grip.
 */
export function PullLever({
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  label = 'Beam Intensity',
  unit = '%',
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  label?: string;
  unit?: string;
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const trackRectRef = useRef<{ top: number; height: number } | null>(null);
  const [active, setActive] = useState(false);

  const range = max - min;
  const normalized = range > 0 ? clamp((value - min) / range, 0, 1) : 0;
  const topFraction = 1 - normalized; // 100% at top, 0% at bottom

  const setClamped = (next: number) => {
    const snapped = min + Math.round((clamp(next, min, max) - min) / step) * step;
    onChange(clamp(Number(snapped.toFixed(2)), min, max));
  };

  const updateFromClientY = (clientY: number) => {
    const rect = trackRectRef.current;
    if (!rect) return;
    const pad = 14;
    const usableHeight = Math.max(1, rect.height - pad * 2);
    const ratioFromTop = clamp((clientY - (rect.top + pad)) / usableHeight, 0, 1);
    const nextNorm = 1 - ratioFromTop;
    setClamped(min + nextNorm * range);
  };

  return (
    <div className="tactile-control-wrapper flex flex-col items-center">
      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-medium">
        {label}
      </div>
      <div
        ref={trackRef}
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        className={`w-12 h-36 bg-slate-950 border border-slate-800 rounded-lg relative cursor-pointer select-none overflow-hidden ${
          active ? 'ring-2 ring-amber-500/50' : ''
        }`}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          pointerIdRef.current = e.pointerId;
          const b = trackRef.current?.getBoundingClientRect();
          if (b) trackRectRef.current = { top: b.top, height: b.height };
          e.currentTarget.setPointerCapture(e.pointerId);
          setActive(true);
          updateFromClientY(e.clientY);
        }}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
          if (pointerIdRef.current !== e.pointerId) return;
          updateFromClientY(e.clientY);
        }}
        onPointerUp={(e: PointerEvent<HTMLDivElement>) => {
          if (pointerIdRef.current !== e.pointerId) return;
          pointerIdRef.current = null;
          trackRectRef.current = null;
          setActive(false);
          e.currentTarget.releasePointerCapture(e.pointerId);
        }}
        onPointerCancel={() => {
          pointerIdRef.current = null;
          trackRectRef.current = null;
          setActive(false);
        }}
      >
        {/* Slot channel */}
        <div className="absolute left-1/2 top-3 bottom-3 -translate-x-1/2 w-2 bg-slate-900 border-x border-slate-800 rounded-full" />

        {/* Lit progress fill */}
        <div
          className="absolute left-1/2 bottom-3 -translate-x-1/2 w-1.5 bg-gradient-to-t from-amber-600 to-amber-400 rounded-full shadow-[0_0_8px_#f59e0b]"
          style={{ height: `${normalized * 82}%` }}
        />

        {/* Graduations */}
        <div className="absolute right-1 top-4 bottom-4 flex flex-col justify-between pointer-events-none opacity-40">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="w-1.5 h-0.5 bg-slate-400" />
          ))}
        </div>

        {/* Heavy Mechanical Grip Handle */}
        <div
          className="absolute left-1/2 -translate-x-1/2 w-9 h-6 bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border border-slate-600 rounded shadow-lg flex items-center justify-center transition-all pointer-events-none"
          style={{
            top: `calc(8px + ${topFraction * 78}%)`,
            boxShadow: active ? '0 0 14px rgba(245, 158, 11, 0.4)' : '0 2px 6px rgba(0,0,0,0.6)',
          }}
        >
          <div className="flex gap-1">
            <div className="w-0.5 h-3 bg-slate-500 rounded" />
            <div className="w-0.5 h-3 bg-slate-500 rounded" />
            <div className="w-0.5 h-3 bg-slate-500 rounded" />
          </div>
        </div>
      </div>
      <div className="mt-2 font-mono text-xs text-amber-400 font-semibold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">
        {Math.round(value)}{unit}
      </div>
    </div>
  );
}

/**
 * 2-Axis Tactile Gimbal Joystick for Flight & Turret Camera Control.
 */
export function TactileJoystick({
  value,
  onChange,
  label = 'Flight Gimbal',
}: {
  value: JoystickValue;
  onChange: (value: JoystickValue) => void;
  label?: string;
}) {
  const padRef = useRef<HTMLDivElement | null>(null);
  const pointerIdRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);

  const updateFromPointer = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) return;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 12;

    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    let nx = dist > 0 ? (dx / maxRadius) : 0;
    let ny = dist > 0 ? (dy / maxRadius) : 0;

    if (dist > maxRadius) {
      nx = (dx / dist);
      ny = (dy / dist);
    }

    onChange({
      x: clamp(Number(nx.toFixed(3)), -1, 1),
      y: clamp(Number(ny.toFixed(3)), -1, 1),
    });
  };

  const resetToCenter = () => {
    onChange({ x: 0, y: 0 });
    setActive(false);
  };

  return (
    <div className="tactile-control-wrapper flex flex-col items-center">
      <div className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-2 font-medium">
        {label}
      </div>
      <div
        ref={padRef}
        className={`w-28 h-28 rounded-full bg-slate-950 border-2 border-slate-800 relative cursor-grab active:cursor-grabbing select-none flex items-center justify-center ${
          active ? 'border-emerald-500/60 shadow-[0_0_16px_rgba(16,185,129,0.3)]' : ''
        }`}
        onPointerDown={(e: PointerEvent<HTMLDivElement>) => {
          pointerIdRef.current = e.pointerId;
          e.currentTarget.setPointerCapture(e.pointerId);
          setActive(true);
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerMove={(e: PointerEvent<HTMLDivElement>) => {
          if (pointerIdRef.current !== e.pointerId) return;
          updateFromPointer(e.clientX, e.clientY);
        }}
        onPointerUp={(e: PointerEvent<HTMLDivElement>) => {
          if (pointerIdRef.current !== e.pointerId) return;
          pointerIdRef.current = null;
          e.currentTarget.releasePointerCapture(e.pointerId);
          resetToCenter();
        }}
        onPointerCancel={() => {
          pointerIdRef.current = null;
          resetToCenter();
        }}
      >
        {/* Crosshair lines */}
        <div className="absolute inset-x-2 top-1/2 -translate-y-1/2 h-[1px] bg-slate-800 pointer-events-none" />
        <div className="absolute inset-y-2 left-1/2 -translate-x-1/2 w-[1px] bg-slate-800 pointer-events-none" />
        <div className="w-12 h-12 rounded-full border border-slate-800/80 pointer-events-none" />

        {/* Joystick Thumb Stick */}
        <div
          className="w-10 h-10 rounded-full bg-gradient-to-b from-slate-700 via-slate-800 to-slate-900 border border-slate-500 shadow-md flex items-center justify-center absolute transition-transform"
          style={{
            transform: `translate(${value.x * 34}px, ${value.y * 34}px)`,
          }}
        >
          <div className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
        </div>
      </div>
      <div className="mt-2 font-mono text-[10px] text-emerald-400 font-semibold px-2 py-0.5 rounded bg-slate-900/80 border border-slate-800">
        X: {value.x > 0 ? `+${value.x.toFixed(2)}` : value.x.toFixed(2)} | Y: {value.y > 0 ? `+${value.y.toFixed(2)}` : value.y.toFixed(2)}
      </div>
    </div>
  );
}
