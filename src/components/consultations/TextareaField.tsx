import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

const textareaBase =
  "w-full rounded-lg bg-white/10 border px-3 py-2 text-white placeholder-white/40 focus:outline-none focus:ring-2 transition-colors resize-y";

interface TextareaFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  rows?: number;
  minCount?: number;
}

export function TextareaField({
  id,
  name,
  label,
  value,
  onChange,
  placeholder,
  error,
  rows = 4,
  minCount,
}: TextareaFieldProps) {
  const count = value.trim().length;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-blue-100/80">
        {label}
      </label>
      <textarea
        id={id}
        name={name ?? id}
        value={value}
        rows={rows}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        placeholder={placeholder}
        className={cn(
          textareaBase,
          error ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
        )}
      />
      {error ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
          <CircleAlert className="size-3" />
          {error}
        </p>
      ) : null}
      {minCount !== undefined ? (
        <p className="mt-1 text-xs text-blue-100/50">
          {count} / min. {minCount}
        </p>
      ) : null}
    </div>
  );
}
