type StatCardProps = {
  label: string;
  value: string | number;
  tone?: "mint" | "rose" | "sand";
};

const toneMap = {
  mint: "bg-[var(--mint)] text-[var(--plum)]",
  rose: "bg-[rgba(227,164,180,0.4)] text-[var(--plum)]",
  sand: "bg-[rgba(244,239,233,0.8)] text-[var(--plum)]",
};

export default function StatCard({ label, value, tone = "sand" }: StatCardProps) {
  return (
    <div className={`surface flex flex-col gap-3 p-5 ${toneMap[tone]}`}>
      <p className="text-xs uppercase tracking-[0.35em]">{label}</p>
      <p className="text-3xl font-semibold">{value}</p>
    </div>
  );
}
