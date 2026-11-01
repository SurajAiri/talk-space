import { useAuthStore } from "../store/auth.store";

/** The mark: a voice (dot), the space where it is heard clearly (solid ring), and where it fades out (dashed ring). */
export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      focusable="false"
      className="logo-mark"
    >
      <rect width="32" height="32" rx="9" fill="var(--brand)" />
      <circle cx="16" cy="16" r="3.4" fill="#fff" />
      <circle
        cx="16"
        cy="16"
        r="8"
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
      />
      <circle
        cx="16"
        cy="16"
        r="12.6"
        fill="none"
        stroke="#fff"
        strokeOpacity=".6"
        strokeWidth="2"
        strokeDasharray="1.2 4.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <a
      href={useAuthStore.getState().user ? "/home" : "/"}
      className="logo-link"
    >
      <span
        className="logo"
        style={{ fontSize: size, lineHeight: `${size}px` }}
      >
        <LogoMark size={size} />
        <span className="logo-word">Talk Space</span>
      </span>
    </a>
  );
}
