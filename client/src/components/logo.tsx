interface LogoProps {
  className?: string;
}

// Geometric shield-and-checkmark mark. Monochrome via currentColor so it
// adapts to light/dark and to whichever text color wraps it.
export function Logo({ className }: LogoProps) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="ClearanceScore"
      role="img"
    >
      <title>ClearanceScore</title>
      <path
        d="M8 6 L32 6 C34 6 34 8 34 10 L34 18 C34 27 28 34 20 37 C12 34 6 27 6 18 L6 10 C6 8 6 6 8 6 Z"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 20 L17.5 26 L28 13"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
