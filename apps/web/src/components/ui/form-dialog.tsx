"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { X, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FormDialog({
  title,
  icon: Icon,
  children,
  onClose,
  busy = false,
}: {
  title: string;
  icon?: LucideIcon;
  children: ReactNode;
  onClose: () => void;
  busy?: boolean;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    let frame = 0;
    const revealFocus = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const scroller = content.current;
        const focused = document.activeElement;
        if (
          !scroller ||
          !(focused instanceof HTMLElement) ||
          !scroller.contains(focused)
        )
          return;
        const visible = scroller.getBoundingClientRect();
        const input = focused.getBoundingClientRect();
        if (input.height > visible.height - 24 || input.top < visible.top + 12)
          scroller.scrollTop += input.top - visible.top - 12;
        else if (input.bottom > visible.bottom - 12)
          scroller.scrollTop += input.bottom - visible.bottom + 12;
      });
    };
    const resize = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight;
      element.style.maxHeight = `${Math.max(160, height - 32)}px`;
      element.style.top = `${(viewport?.offsetTop ?? 0) + height / 2}px`;
      revealFocus();
    };
    resize();
    element.showModal();
    window.visualViewport?.addEventListener("resize", resize);
    window.visualViewport?.addEventListener("scroll", resize);
    window.addEventListener("resize", resize);
    element.addEventListener("focusin", revealFocus);
    return () => {
      window.visualViewport?.removeEventListener("resize", resize);
      window.visualViewport?.removeEventListener("scroll", resize);
      window.removeEventListener("resize", resize);
      element.removeEventListener("focusin", revealFocus);
      cancelAnimationFrame(frame);
      element.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus({ preventScroll: true });
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget || busy) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
      className="fixed inset-x-0 bottom-auto mx-auto my-0 w-[calc(100%-2rem)] max-w-lg -translate-y-1/2 flex-col overflow-hidden rounded-3xl border bg-card p-0 text-foreground shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-sm open:flex"
    >
      <div className="flex shrink-0 items-center gap-3 border-b px-5 py-4">
        {Icon && (
          <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Icon className="size-5" />
          </span>
        )}
        <h2
          id={titleId}
          className="min-w-0 flex-1 truncate text-lg font-semibold tracking-tight"
        >
          {title}
        </h2>
        <Button
          autoFocus
          type="button"
          variant="ghost"
          size="icon"
          className="size-10 rounded-full"
          aria-label={`Close ${title.toLowerCase()}`}
          title="Close"
          disabled={busy}
          onClick={onClose}
        >
          <X className="size-5" />
        </Button>
      </div>
      <div
        ref={content}
        className="min-h-0 overflow-y-auto overscroll-contain p-5"
      >
        {children}
      </div>
    </dialog>
  );
}
