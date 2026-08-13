"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  panelClassName?: string;
  /** Extra classes on the fixed overlay (e.g. higher z-index, force center). */
  overlayClassName?: string;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  panelClassName,
  overlayClassName,
}: ModalProps) {
  if (!open) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-end justify-center p-3 sm:items-center sm:p-4",
        overlayClassName
      )}
    >
      <button
        type="button"
        aria-label="Close modal overlay"
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]"
        onClick={onClose}
      />
      <div
        className={cn(
          "card relative z-10 flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden shadow-lg",
          "mb-[env(safe-area-inset-bottom)] sm:mb-0",
          panelClassName
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border-subtle px-4 py-4 sm:px-6">
          <h2
            id="modal-title"
            className="min-w-0 flex-1 break-words text-lg font-bold text-foreground"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon shrink-0"
            aria-label="Close dialog"
          >
            <X className="size-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-6">
          {children}
        </div>
        {footer ? (
          <div className="flex shrink-0 flex-wrap justify-end gap-2 border-t border-border-subtle px-4 py-4 sm:px-6">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
