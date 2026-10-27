import { useEffect, useId, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

interface Props {
  open: boolean;
  title: string;
  onClose: () => void;
  icon?: ReactNode;
  tone?: 'ok' | 'warn' | 'no' | 'info';
  children?: ReactNode;
  actions: ReactNode;
  /** Botón que recibe el foco al abrir (por ejemplo "Volver y marcar"). */
  initialFocusRef?: RefObject<HTMLElement | null>;
  role?: 'dialog' | 'alertdialog';
}

/** Diálogo modal accesible sobre <dialog>: atrapa el foco, Escape cierra y el foco vuelve a donde estaba. */
export function Dialog({ open, title, onClose, icon, tone = 'info', children, actions, initialFocusRef, role = 'dialog' }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const previo = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      previo.current = document.activeElement as HTMLElement | null;
      if (typeof d.showModal === 'function') d.showModal();
      else d.setAttribute('open', '');
      // showModal enfoca el primer botón; se pasa enseguida a la opción segura indicada.
      initialFocusRef?.current?.focus();
      requestAnimationFrame(() => {
        if (d.open && initialFocusRef?.current && !d.contains(document.activeElement)) initialFocusRef.current.focus();
      });
    } else if (!open && d.open) {
      if (typeof d.close === 'function') d.close();
      else d.removeAttribute('open');
      const p = previo.current;
      if (p && document.contains(p)) p.focus();
    }
  }, [open, initialFocusRef]);

  return (
    <dialog
      ref={ref}
      className="dialog"
      role={role}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      {open && (
        <div className="dialog-body">
          {icon && <div className={`dialog-icon ${tone}`} aria-hidden="true">{icon}</div>}
          <h2 id={titleId}>{title}</h2>
          {children}
          <div className="dialog-actions">{actions}</div>
        </div>
      )}
    </dialog>
  );
}
