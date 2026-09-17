"use client";

export type LayoutOption<T extends string> = {
  value: T;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
};

/**
 * Icon-only, because the shapes are the conventional pictures of themselves and
 * the labels would be longer than the control. The names are still there for
 * anyone not reading the icons.
 */
export function LayoutToggle<T extends string>({
  label,
  options,
  value,
  onChange,
  className = "",
}: {
  /** What is being laid out, for the group's accessible name. */
  label: string;
  options: LayoutOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`flex gap-0.5 rounded-lg bg-canvas p-0.5 ${className}`}>
      {options.map(({ value: option, label: name, icon: Icon }) => {
        const active = value === option;

        return (
          <button
            key={option}
            type="button"
            onClick={() => onChange(option)}
            aria-pressed={active}
            title={`${name} view`}
            className={`grid size-8 place-items-center rounded-md transition-colors ${
              active ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink"
            }`}
          >
            <Icon className="size-4" />
            <span className="sr-only">{name} view</span>
          </button>
        );
      })}
    </div>
  );
}
