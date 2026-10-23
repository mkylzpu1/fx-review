import type { ReactNode } from "react";

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ title, description, action }: EmptyStateProps) {
  return (
    <div className="card flex flex-col items-center gap-3 py-12 text-center">
      <p className="text-base font-bold">{title}</p>
      {description && (
        <p className="max-w-md text-sm text-ink-sub">{description}</p>
      )}
      {action}
    </div>
  );
}
