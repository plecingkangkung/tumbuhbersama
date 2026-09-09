import {
  Children,
  isValidElement,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Check, ChevronDown } from "lucide-react";
const textOf = (value) =>
  Children.toArray(value)
    .map((v) => (isValidElement(v) ? textOf(v.props.children) : String(v)))
    .join("");
export default function Select({
  children,
  value,
  defaultValue,
  onChange,
  name,
  required,
  disabled,
  className = "",
  id,
  ...props
}) {
  const options = Children.toArray(children)
    .filter(isValidElement)
    .map((c) => ({
      value: String(c.props.value ?? textOf(c.props.children)),
      label: textOf(c.props.children),
      disabled: Boolean(c.props.disabled),
    }));
  const [internal, setInternal] = useState(() =>
    String(defaultValue ?? options[0]?.value ?? ""),
  );
  const resetValue = String(defaultValue ?? options[0]?.value ?? "");
  const selected = String(value ?? internal),
    current = options.find((o) => o.value === selected);
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(-1),
    [invalid, setInvalid] = useState(false);
  const uid = useId(),
    listId = `select-${uid}`,
    trigger = useRef(null),
    panel = useRef(null),
    native = useRef(null),
    search = useRef({ text: "", time: 0 });
  function close() {
    setOpen(false);
  }
  function show() {
    if (disabled) return;
    const index = options.findIndex((o) => o.value === selected && !o.disabled);
    setActive(index >= 0 ? index : options.findIndex((o) => !o.disabled));
    setOpen(true);
  }
  function choose(option) {
    if (!option || option.disabled) return;
    setInternal(option.value);
    setInvalid(false);
    native.current.value = option.value;
    onChange?.({
      target: native.current,
      currentTarget: native.current,
      type: "change",
    });
    close();
    trigger.current.focus();
  }
  useLayoutEffect(() => {
    if (!open) {
      panel.current?.hidePopover();
      return;
    }
    const box = trigger.current.getBoundingClientRect(),
      width = Math.min(Math.max(box.width, 210), window.innerWidth - 24),
      below = window.innerHeight - box.bottom - 12,
      above = box.top - 12;
    const upward = below < 180 && above > below,
      maxHeight = Math.max(80, Math.min(280, upward ? above : below));
    Object.assign(panel.current.style, {
      width: `${width}px`,
      maxHeight: `${maxHeight}px`,
      left: `${Math.max(12, Math.min(box.left, window.innerWidth - width - 12))}px`,
      top: upward ? "auto" : `${box.bottom + 6}px`,
      bottom: upward ? `${window.innerHeight - box.top + 6}px` : "auto",
    });
    panel.current.showPopover();
    const dismiss = (event) => {
      if (!panel.current?.contains(event.target)) setOpen(false);
    };
    window.addEventListener("resize", dismiss);
    window.addEventListener("scroll", dismiss, true);
    return () => {
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("scroll", dismiss, true);
    };
  }, [open]);
  useEffect(() => {
    if (open)
      panel.current
        ?.querySelector(`[data-index="${active}"]`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active]);
  useEffect(() => {
    const form = native.current?.form;
    const reset = () => {
      setInternal(resetValue);
      setInvalid(false);
      setOpen(false);
    };
    form?.addEventListener("reset", reset);
    return () => form?.removeEventListener("reset", reset);
  }, [resetValue]);
  function keyDown(e) {
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      const enabled = options
        .map((o, i) => (!o.disabled ? i : -1))
        .filter((i) => i >= 0);
      if (!enabled.length) return;
      if (!open) {
        setOpen(true);
        setActive(
          e.key === "ArrowUp" || e.key === "End"
            ? enabled.at(-1)
            : e.key === "Home"
              ? enabled[0]
              : Math.max(
                  enabled[0],
                  options.findIndex((o) => o.value === selected && !o.disabled),
                ),
        );
        return;
      }
      const index = enabled.indexOf(active);
      setActive(
        e.key === "Home"
          ? enabled[0]
          : e.key === "End"
            ? enabled.at(-1)
            : enabled[
                (index + (e.key === "ArrowDown" ? 1 : -1) + enabled.length) %
                  enabled.length
              ],
      );
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (open) choose(options[active]);
      else show();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const now = Date.now();
      search.current = {
        text:
          (now - search.current.time < 700 ? search.current.text : "") +
          e.key.toLocaleLowerCase(),
        time: now,
      };
      const index = options.findIndex(
        (o) =>
          !o.disabled &&
          o.label.toLocaleLowerCase().startsWith(search.current.text),
      );
      if (index >= 0) {
        e.preventDefault();
        setActive(index);
        setOpen(true);
      }
    }
  }
  const label =
    props["aria-label"] ??
    {
      sex: "Jenis kelamin",
      category: "Kategori",
      height_position: "Posisi pengukuran",
    }[name];
  return (
    <span className={`app-select ${className}`}>
      <button
        {...props}
        id={id}
        ref={trigger}
        type="button"
        className={`select-trigger ${invalid ? "is-invalid" : ""}`}
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        aria-activedescendant={
          open && active >= 0 ? `${listId}-${active}` : undefined
        }
        aria-required={required || undefined}
        aria-invalid={invalid || undefined}
        disabled={disabled}
        onClick={(e) => {
          e.preventDefault();
          open ? close() : show();
        }}
        onKeyDown={keyDown}
        onBlur={close}
      >
        <span>{current?.label || "Pilih opsi"}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      <select
        ref={native}
        name={name}
        value={selected}
        required={required}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden="true"
        className="select-native"
        onChange={(e) => {
          setInternal(e.target.value);
          setInvalid(false);
          onChange?.(e);
        }}
        onInvalid={(e) => {
          e.preventDefault();
          setInvalid(true);
          trigger.current.focus();
          show();
        }}
      >
        {children}
      </select>
      <span
        ref={panel}
        id={listId}
        role="listbox"
        aria-label={label ?? "Pilihan"}
        popover="auto"
        className="select-options"
        onToggle={(e) => {
          if (e.newState === "closed") setOpen(false);
        }}
      >
        {options.map((option, i) => (
          <span
            key={`${option.value}-${i}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={option.value === selected}
            aria-disabled={option.disabled || undefined}
            data-index={i}
            className={`select-option ${i === active ? "is-active" : ""} ${option.value === selected ? "is-selected" : ""} ${option.disabled ? "is-disabled" : ""}`}
            onPointerDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              choose(option);
            }}
          >
            <span>{option.label}</span>
            {option.value === selected && (
              <Check size={16} aria-hidden="true" />
            )}
          </span>
        ))}
        {!options.length && (
          <span className="select-empty">Belum ada pilihan.</span>
        )}
      </span>
      {invalid && (
        <span className="select-error" role="alert">
          Pilih salah satu opsi.
        </span>
      )}
    </span>
  );
}
