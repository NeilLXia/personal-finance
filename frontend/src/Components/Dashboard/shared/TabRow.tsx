import styles from "../dashboard.shared.module.css";

type TabRowOption<TValue extends string> = {
  label: string;
  value: TValue;
};

type TabRowProps<TValue extends string> = {
  ariaLabel: string;
  options: Array<TabRowOption<TValue>>;
  value: TValue;
  onChange: (value: TValue) => void;
  compact?: boolean;
};

const TabRow = <TValue extends string>({
  ariaLabel,
  options,
  value,
  onChange,
  compact = false,
}: TabRowProps<TValue>) => (
  <div
    className={`${styles.tabRow} ${compact ? styles.tabRowCompact : ""}`}
    role="tablist"
    aria-label={ariaLabel}
  >
    {options.map((option) => (
      <button
        type="button"
        className={option.value === value ? styles.tabActive : styles.tab}
        key={option.value}
        onClick={() => onChange(option.value)}
      >
        {option.label}
      </button>
    ))}
  </div>
);

export default TabRow;
