'use client';

interface F92LogoProps {
  size?: number;
  className?: string;
  'aria-hidden'?: boolean;
}

export function F92Logo({ size = 40, className, ...rest }: F92LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      {...rest}
    >
      <ellipse
        cx="50" cy="50" rx="46" ry="14"
        stroke="#F47920"
        strokeWidth="4"
        fill="none"
      />
      <ellipse
        cx="50" cy="50" rx="46" ry="14"
        stroke="#C9A77B"
        strokeWidth="4"
        fill="none"
        transform="rotate(-60 50 50)"
      />
      <ellipse
        cx="50" cy="50" rx="46" ry="14"
        stroke="#1E2D6B"
        strokeWidth="4"
        fill="none"
        transform="rotate(60 50 50)"
      />
      <circle
        cx="50" cy="50" r="15"
        stroke="#3B82F6"
        strokeWidth="4"
        fill="none"
      />
      <circle cx="50" cy="50" r="9" fill="#FFFFFF" />
    </svg>
  );
}
