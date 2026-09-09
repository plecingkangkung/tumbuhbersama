import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
export default function ResponsiveSidebar({ open, onClose, children }) {
  const [mobile, setMobile] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  const dialog = useRef(null);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const change = () => {
      setMobile(media.matches);
      onClose();
    };
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, [onClose]);
  useEffect(() => {
    if (!mobile || !open) {
      dialog.current?.close();
      return;
    }
    dialog.current.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobile, open]);
  if (!mobile) return <aside className="sidebar">{children}</aside>;
  return (
    <dialog
      ref={dialog}
      id="mobile-navigation"
      className="mobile-sidebar"
      aria-label="Menu navigasi"
      onClose={onClose}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="sidebar">
        <button
          type="button"
          className="sidebar-close icon-button"
          aria-label="Tutup menu"
          onClick={onClose}
        >
          <X size={20} />
        </button>
        {children}
      </aside>
    </dialog>
  );
}
