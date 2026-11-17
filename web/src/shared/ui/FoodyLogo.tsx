// Foody's mark: a bitten cookie with chocolate chips on a warm tile.
export function FoodyLogo({ size = 32 }: { size?: number }) {
  return (
    <svg aria-hidden="true" className="foody-logo" height={size} viewBox="0 0 48 48" width={size}>
      <rect fill="#F97316" height="48" rx="12" width="48" />
      <path d="M24 9a15 15 0 1 0 14.6 11.6 4.5 4.5 0 0 1-5.6-5.6A4.5 4.5 0 0 1 27.4 9.4 15 15 0 0 0 24 9Z" fill="#FDE6C4" />
      <circle cx="18" cy="20" fill="#7C3F1D" r="2.4" />
      <circle cx="27" cy="25" fill="#7C3F1D" r="2.2" />
      <circle cx="18.5" cy="30" fill="#7C3F1D" r="2" />
      <circle cx="29" cy="33" fill="#7C3F1D" r="1.8" />
      <circle cx="23" cy="36" fill="#7C3F1D" r="1.4" />
    </svg>
  );
}
