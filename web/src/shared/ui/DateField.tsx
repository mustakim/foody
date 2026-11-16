import { CalendarDays } from "lucide-react";
import { useRef } from "react";
import type { InputHTMLAttributes } from "react";

// A native date/month input whose whole box opens the calendar, with a
// visible calendar button (the browser's own icon is hard to see in dark mode).
export function DateField({ label, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const input = useRef<HTMLInputElement>(null);
  const open = () => {
    try {
      input.current?.showPicker();
    } catch {
      input.current?.focus();
    }
  };

  return (
    <label className="form-field date-field">
      <span>{label}</span>
      <div className="date-field-box">
        <input ref={input} onClick={open} {...props} />
        <button type="button" className="date-field-button" aria-label={`Open calendar for ${label}`} onClick={open}>
          <CalendarDays size={18} />
        </button>
      </div>
    </label>
  );
}
