import {
  useEffect,
  useLayoutEffect,
  useId,
  useRef,
  type ReactNode,
} from "react";
import { X } from "lucide-react";
export function StudioDialog({
  title,
  children,
  onClose,
  wide = false,
  busy = false,
  viewKey,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
  busy?: boolean;
  viewKey?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const scrollPositions = useRef(new Map<string, number>());
  const previousView = useRef<string | undefined>(undefined);
  const label = useId();
  useLayoutEffect(() => {
    if (!viewKey || !content.current) return;
    const element = content.current;
    element.scrollTop = scrollPositions.current.get(viewKey) || 0;
    if (previousView.current && previousView.current !== viewKey)
      heading.current?.focus({ preventScroll: true });
    previousView.current = viewKey;
  }, [viewKey]);
  useEffect(() => {
    const element = ref.current!;
    const focus = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = overflow;
      if (focus?.isConnected) focus.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`studio-dialog ${wide ? "is-wide" : ""}`}
      aria-labelledby={label}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (!busy) onClose();
      }}
    >
      <header>
        <h2 id={label} ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <button
          className="icon-button"
          disabled={busy}
          aria-label={`Cerrar ${title.toLocaleLowerCase()}`}
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </header>
      <div
        ref={content}
        className="studio-dialog-content"
        onScroll={(event) => {
          if (viewKey)
            scrollPositions.current.set(viewKey, event.currentTarget.scrollTop);
        }}
      >
        {children}
      </div>
    </dialog>
  );
}
