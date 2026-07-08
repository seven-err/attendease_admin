import { cn } from "@/lib/utils";

type CardProps = {
  children: React.ReactNode;
  className?: string;
};

export function Card({ children, className }: CardProps) {
  return <div className={cn("card", className)}>{children}</div>;
}

type CardHeaderProps = {
  children: React.ReactNode;
  className?: string;
  action?: React.ReactNode;
};

export function CardHeader({ children, className, action }: CardHeaderProps) {
  return (
    <div className={cn("card-header", className)}>
      <div>{children}</div>
      {action}
    </div>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("card-body", className)}>{children}</div>;
}
