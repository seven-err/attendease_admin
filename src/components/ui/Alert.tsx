import { cn } from "@/lib/utils";

type AlertVariant = "success" | "error" | "warning";

type AlertProps = {
  children: React.ReactNode;
  variant?: AlertVariant;
  onDismiss?: () => void;
  className?: string;
};

const variantClass: Record<AlertVariant, string> = {
  success: "alert alert-success",
  error: "alert alert-error",
  warning: "alert alert-warning",
};

export function Alert({
  children,
  variant = "success",
  onDismiss,
  className,
}: AlertProps) {
  return (
    <div
      className={cn(
        variantClass[variant],
        onDismiss && "flex items-center justify-between gap-3",
        className
      )}
      role="status"
    >
      <span>{children}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 font-bold opacity-80 hover:opacity-100"
        >
          Dismiss
        </button>
      )}
    </div>
  );
}
