
interface ScionLogoProps {
  size?: number;
  withWordmark?: boolean;
  wordmarkColor?: string;
  className?: string;
}

export function ScionMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Scion Hospital"
    >
      {}
      <path
        d="M70 22c-8-9-22-11-33-6-11 5-17 16-14 27 2 7 8 12 16 13-9 1-15 7-16 15-2 11 5 22 17 26 11 4 24 1 32-8-7 5-17 6-25 2-7-3-11-10-9-17 2-6 8-10 15-10h2v-16h-2c-7 0-13-4-15-10-2-7 2-14 9-17 8-4 18-3 25 2 0 0 1-21-7-21Z"
        fill="#1FA64A"
      />
      {}
      <path
        d="M42 30h16v12h12v16H58v12H42V58H30V42h12V30Z"
        fill="#E2231A"
      />
    </svg>
  );
}

export default function ScionLogo({
  size = 40,
  withWordmark = true,
  wordmarkColor,
  className,
}: ScionLogoProps) {
  if (!withWordmark) {
    return <ScionMark size={size} className={className} />;
  }

  return (
    <div className={`flex items-center gap-3 ${className ?? ''}`}>
      <ScionMark size={size} />
      <div className="leading-none">
        <div
          className="font-bold tracking-tight"
          style={{ fontSize: size * 0.5, color: wordmarkColor }}
        >
          SCION <span style={{ fontWeight: 600 }}>Hospital</span>
        </div>
        <div
          className="italic"
          style={{
            fontSize: size * 0.26,
            color: wordmarkColor ?? 'var(--text-muted)',
            marginTop: size * 0.06,
          }}
        >
          Caring from the heart…
        </div>
      </div>
    </div>
  );
}
