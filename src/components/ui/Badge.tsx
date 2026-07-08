import { cn } from "@/lib/utils";

type BadgeVariant = "dept" | "status-open" | "status-active" | "status-closed" | "status-draft" | "status-present" | "status-late" | "status-absent" | "active" | "inactive";

const variants: Record<BadgeVariant, string> = {
  dept: "bg-maroon-light text-maroon",
  "status-open": "border border-maroon text-maroon bg-transparent",
  "status-active": "bg-maroon text-white",
  "status-closed": "border border-green-600 text-green-600 bg-transparent",
  "status-draft": "border border-border text-text-muted bg-transparent",
  "status-present": "border border-green-600 text-green-600 bg-transparent",
  "status-late": "border border-red-300 text-red-500 bg-transparent",
  "status-absent": "bg-maroon text-white",
  active: "bg-maroon text-white",
  inactive: "border border-maroon text-maroon bg-transparent",
};

const deptColors: Record<string, string> = {
  CCS: "bg-blue-50 border border-blue-200 text-blue-700",
  CBE: "bg-pink-50 border border-pink-200 text-pink-700",
  CCJE: "bg-green-50 border border-green-200 text-green-700",
  CTE: "bg-yellow-50 border border-yellow-200 text-yellow-700",
};

export function Badge({
  children,
  variant = "dept",
  dept,
  className,
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  dept?: string;
  className?: string;
}) {
  // Backwards-compat: legacy rows may still contain `CRIM`.
  const normalizedDept = dept === "CRIM" ? "CCJE" : dept;
  const deptClass =
    normalizedDept && deptColors[normalizedDept]
      ? deptColors[normalizedDept]
      : variants[variant];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-bold uppercase leading-4 tracking-wide",
        normalizedDept && deptColors[normalizedDept]
          ? deptClass
          : variants[variant],
        className
      )}
    >
      {children}
    </span>
  );
}
