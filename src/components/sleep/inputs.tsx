import type { ReactNode } from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export function Field({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor} className="text-sm font-medium text-foreground">
        {label}
      </Label>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {children}
    </div>
  );
}

export function DateTimeField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} htmlFor={id}>
      <Input
        id={id}
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 text-base"
      />
    </Field>
  );
}

function pillClass(active: boolean) {
  return cn(
    "min-h-11 rounded-2xl border px-4 py-2.5 text-sm transition-colors",
    active
      ? "border-primary bg-primary text-primary-foreground shadow-soft"
      : "border-border bg-card text-foreground hover:bg-secondary",
  );
}

export function ScalePicker({
  label,
  value,
  onChange,
  labels,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  labels?: Record<number, string>;
}) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-5 gap-2" role="group" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={cn(pillClass(value === n), "flex flex-col items-center gap-0.5 px-1")}
          >
            <span className="text-base font-medium">{n}</span>
            {labels?.[n] ? <span className="text-[10px] leading-tight opacity-80">{labels[n]}</span> : null}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function ChoiceGroup<T extends string | number>({
  label,
  value,
  options,
  onChange,
  allowClear = true,
}: {
  label: string;
  value: T | null;
  options: { label: string; value: T }[];
  onChange: (value: T | null) => void;
  allowClear?: boolean;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={String(option.value)}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(allowClear && value === option.value ? null : option.value)}
            className={pillClass(value === option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function MultiChoice({
  label,
  values,
  options,
  onToggle,
}: {
  label: string;
  values: string[];
  options: { label: string; value: string }[];
  onToggle: (value: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={values.includes(option.value)}
            onClick={() => onToggle(option.value)}
            className={pillClass(values.includes(option.value))}
          >
            {option.label}
          </button>
        ))}
      </div>
    </Field>
  );
}

export function YesNo({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean | null;
  onChange: (value: boolean | null) => void;
}) {
  return (
    <ChoiceGroup<string>
      label={label}
      value={value == null ? null : value ? "yes" : "no"}
      options={[
        { label: "Yes", value: "yes" },
        { label: "No", value: "no" },
      ]}
      onChange={(next) => onChange(next == null ? null : next === "yes")}
    />
  );
}
