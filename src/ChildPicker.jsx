import { useRef } from "react";
import { Check, ChevronDown, Plus } from "lucide-react";
export default function ChildPicker({
  children,
  selected,
  onSelect,
  onAdd,
  subtitle,
}) {
  const dropdown = useRef(null);
  const current = children.find((child) => child.id === selected);
  return (
    <section className="child-strip">
      <div className="child-avatar" aria-hidden="true">
        {current?.name.slice(0, 1).toUpperCase() || "+"}
      </div>
      <div className="child-profile-info">
        <span className="child-label">Profil anak</span>
        <details
          className="child-picker"
          ref={dropdown}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget))
              event.currentTarget.open = false;
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.currentTarget.open = false;
              event.currentTarget.querySelector("summary").focus();
            }
            if (["ArrowDown", "ArrowUp"].includes(event.key)) {
              event.preventDefault();
              event.currentTarget.open = true;
              const choices = [
                ...event.currentTarget.querySelectorAll(".child-choice"),
              ];
              if (!choices.length) return;
              const i = choices.indexOf(document.activeElement);
              choices[
                i < 0
                  ? event.key === "ArrowDown"
                    ? 0
                    : choices.length - 1
                  : (i +
                      (event.key === "ArrowDown" ? 1 : -1) +
                      choices.length) %
                    choices.length
              ].focus();
            }
          }}
        >
          <summary
            aria-label={`Pilih profil anak, saat ini ${current?.name || "belum dipilih"}`}
          >
            <span>{current?.name || "Pilih profil anak"}</span>
            <ChevronDown size={15} />
          </summary>
          <div className="child-options">
            <p className="child-options-label">Pilih profil</p>
            {children.length ? (
              children.map((child) => (
                <button
                  type="button"
                  className="child-choice"
                  key={child.id}
                  aria-pressed={child.id === selected}
                  onClick={() => {
                    onSelect(child.id);
                    dropdown.current.open = false;
                    dropdown.current.querySelector("summary").focus();
                  }}
                >
                  <span className="child-choice-avatar" aria-hidden="true">
                    {child.name.slice(0, 1).toUpperCase()}
                  </span>
                  <span className="child-choice-name">{child.name}</span>
                  {child.id === selected && <Check size={16} />}
                </button>
              ))
            ) : (
              <p className="child-options-empty">Belum ada profil anak.</p>
            )}
            <button
              type="button"
              className="child-choice-add"
              onClick={() => {
                dropdown.current.open = false;
                onAdd();
              }}
            >
              <Plus size={15} />
              Tambah profil anak
            </button>
          </div>
        </details>
        {subtitle && <p className="child-subtitle">{subtitle}</p>}
      </div>
      <button type="button" className="secondary child-add" onClick={onAdd}>
        <Plus size={15} />
        <span>Tambah anak</span>
      </button>
    </section>
  );
}
