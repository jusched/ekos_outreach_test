type StatusPillProps = {
  label: string;
  tone?: "neutral" | "good" | "warn" | "bad";
};

export function StatusPill({ label, tone = "neutral" }: StatusPillProps) {
  return <span className={`statusPill statusPill--${tone}`}>{label}</span>;
}
