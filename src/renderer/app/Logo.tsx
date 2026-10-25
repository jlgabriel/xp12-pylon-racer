// The app's mark: the pylon and the racing line of the app icon (resources/icon.svg), without the
// tile behind it, in token colors.
export function LogoMark({ size = 24 }: { size?: number }) {
  return (
    <svg className="logo-mark" width={size} height={size} viewBox="150 150 724 724" aria-hidden>
      <defs>
        <clipPath id="logo-body">
          <path d="M414 826 L470 214 Q512 186 554 214 L610 826 Z" />
        </clipPath>
        <clipPath id="logo-front">
          <rect x="0" y="540" width="1024" height="484" />
        </clipPath>
        <clipPath id="logo-back">
          <rect x="0" y="0" width="1024" height="540" />
        </clipPath>
        <pattern id="logo-checker" width="64" height="64" patternUnits="userSpaceOnUse" x="448" y="270">
          <rect className="logo-pylon" width="64" height="64" />
          <rect className="logo-check" width="32" height="32" />
          <rect className="logo-check" x="32" y="32" width="32" height="32" />
        </pattern>
      </defs>
      <g transform="rotate(-16 512 540)">
        <ellipse className="logo-line-far" cx="512" cy="540" rx="350" ry="112" fill="none" strokeWidth="40" clipPath="url(#logo-back)" />
      </g>
      <path className="logo-pylon" d="M414 826 L470 214 Q512 186 554 214 L610 826 Z" />
      <rect x="400" y="270" width="230" height="96" fill="url(#logo-checker)" clipPath="url(#logo-body)" />
      <g transform="rotate(-16 512 540)">
        <ellipse className="logo-line" cx="512" cy="540" rx="350" ry="112" fill="none" strokeWidth="52" clipPath="url(#logo-front)" />
        <circle className="logo-plane" cx="862" cy="540" r="48" />
      </g>
    </svg>
  );
}
