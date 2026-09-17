"use client";

import { useEffect, useRef } from "react";

/**
 * A modal dialog, built on the native `<dialog>` element.
 *
 * <p>`showModal()` gives the things a hand-rolled overlay gets wrong: the
 * focus trap, Escape, the inert background, and the top layer — so the dialog
 * paints above everything without a portal or a z-index guess, wherever it
 * happens to sit in the tree.
 *
 * <p>What is left to do by hand is the backdrop click, the body scroll lock,
 * and telling React when the browser closed the dialog on its own.
 */
export function Modal({
  title,
  description,
  onClose,
  children,
}: {
  title: string;
  description?: string;
  /** Called for every route out: Escape, the backdrop, the close button. */
  onClose: () => void;
  children: React.ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  // Held in a ref so opening does not depend on the identity of the callback,
  // which a parent re-render would change — re-running the effect each time.
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;

    if (!element.open) {
      element.showModal();
    }

    // The dialog scrolls itself when it is taller than the viewport; the page
    // behind it must not scroll with it.
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previous;
      if (element.open) {
        element.close();
      }
    };
  }, []);

  return (
    <dialog
      ref={dialog}
      // Escape closes natively; this is how React hears about it.
      onCancel={(event) => {
        event.preventDefault();
        close.current();
      }}
      // A click that lands on the dialog element itself landed on the backdrop:
      // everything inside it is covered by the panel below.
      onClick={(event) => {
        if (event.target === dialog.current) close.current();
      }}
      aria-labelledby="modal-title"
      className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-panel border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-black/50 backdrop:backdrop-blur-[2px]"
    >
      <div className="max-h-[85dvh] overflow-y-auto overscroll-contain p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="modal-title" className="text-sm font-medium">
              {title}
            </h2>
            {description ? (
              <p className="mt-1 max-w-xl text-[0.8125rem] leading-relaxed text-muted">{description}</p>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="-mt-1 -mr-1 grid size-8 shrink-0 place-items-center rounded-lg text-faint transition-colors hover:bg-canvas hover:text-ink"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" aria-hidden>
              <path d="M6 6l12 12M18 6 6 18" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="mt-5">{children}</div>
      </div>
    </dialog>
  );
}
