import Select from "./Select";
import { Plus, Pencil } from "lucide-react";
export default function ChildPicker({
  children,
  selected,
  onSelect,
  onAdd,
  onEdit,
  subtitle,
}) {
  const current = children.find((child) => child.id === selected);
  return (
    <section className="child-strip">
      <div className="child-avatar" aria-hidden="true">
        {current?.name.slice(0, 1).toUpperCase() || "+"}
      </div>
      <div className="child-profile-info">
        <span className="child-label">Profil anak</span>
        <Select
          className="profile-select"
          aria-label="Pilih profil anak"
          value={selected}
          disabled={!children.length}
          onChange={(e) => onSelect(e.target.value)}
        >
          {!children.length && <option value="">Belum ada profil anak</option>}
          {children.map((child) => (
            <option key={child.id} value={child.id}>
              {child.name}
            </option>
          ))}
        </Select>
        {subtitle && <p className="child-subtitle">{subtitle}</p>}
      </div>
      <div className="child-profile-actions">
        {current && (
          <button
            type="button"
            className="secondary"
            onClick={onEdit}
            title="Ubah nama, tanggal lahir, dan jenis kelamin anak"
          >
            <Pencil size={15} />
            <span>Edit profil</span>
          </button>
        )}
        <button type="button" className="secondary child-add" onClick={onAdd}>
          <Plus size={15} />
          <span>Tambah anak</span>
        </button>
      </div>
    </section>
  );
}
