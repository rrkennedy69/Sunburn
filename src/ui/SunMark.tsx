interface Props {
  size?: number;
}

/** The SunBurn sun, shared by the editor brand and the home screen. */
export function SunMark({ size = 28 }: Props) {
  return (
    <svg className="sun-mark" viewBox="0 0 32 32" width={size} height={size} aria-hidden="true">
      <circle cx="16" cy="16" r="5.5" fill="#c47a2c" />
      <g stroke="#c47a2c" strokeWidth="2" strokeLinecap="round">
        <path d="M16 2.5v4.2M16 25.3v4.2M2.5 16h4.2M25.3 16h4.2M6.2 6.2l3 3M22.8 22.8l3 3M25.8 6.2l-3 3M9.2 22.8l-3 3" />
      </g>
    </svg>
  );
}
