export function Alert({ kind = "error", children }: { kind?: "error" | "success" | "info"; children: React.ReactNode }) {
  const styles = {
    error: "border-rose-200 bg-rose-50 text-rose-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-sky-200 bg-sky-50 text-sky-800",
  }[kind];
  return <div className={`rounded-lg border px-3 py-2 text-sm ${styles}`}>{children}</div>;
}
