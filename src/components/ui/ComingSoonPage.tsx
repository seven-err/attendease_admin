import { Construction } from "lucide-react";
import { PageHeader } from "@/components/ui/PageHeader";

type ComingSoonProps = {
  title: string;
  description: string;
};

export function ComingSoonPage({ title, description }: ComingSoonProps) {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader title={title} description={description} />
      <div className="card flex flex-col items-start gap-3 p-6">
        <div className="stat-icon-wrap">
          <Construction className="size-4" aria-hidden />
        </div>
        <p className="text-sm font-medium text-foreground">
          This module is being reconstructed for role-based administration.
        </p>
        <p className="text-sm text-text-secondary">
          Authorization and navigation are live. Full management UI arrives in
          the next implementation phase.
        </p>
      </div>
    </div>
  );
}
