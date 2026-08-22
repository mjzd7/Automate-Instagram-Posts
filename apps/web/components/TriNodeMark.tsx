export function TriNodeMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M 22 28 L 50 78 L 78 28" stroke="currentColor" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <line x1="26" y1="28" x2="74" y2="28" stroke="currentColor" strokeWidth="2" strokeDasharray="3 3" opacity="0.45" />
      <circle cx="22" cy="28" r="6" fill="currentColor" />
      <circle cx="78" cy="28" r="6" fill="currentColor" />
      <circle cx="50" cy="78" r="9" fill="#000000" stroke="currentColor" strokeWidth="4" />
      <circle cx="50" cy="78" r="2.5" fill="currentColor" />
    </svg>
  );
}
