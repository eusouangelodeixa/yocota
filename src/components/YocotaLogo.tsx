export function YocotaLogo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" width={size} height={size} className={className}>
      <circle cx="14" cy="8" r="5" fill="hsl(var(--primary))" />
      <circle cx="8" cy="20" r="5" fill="hsl(var(--primary))" opacity="0.7" />
      <circle cx="20" cy="20" r="5" fill="hsl(var(--primary))" opacity="0.5" />
    </svg>
  );
}
