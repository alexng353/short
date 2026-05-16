import { useEffect, useRef, ReactNode } from "react";

export function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        // close on backdrop click
        if (e.target === e.currentTarget) onClose();
      }}
      style={{ padding: 0, border: "none", borderRadius: 8, maxWidth: 600 }}
    >
      <div style={{ padding: "1.5em" }}>{children}</div>
    </dialog>
  );
}
