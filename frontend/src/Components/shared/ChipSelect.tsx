import styles from "./ChipSelect.module.css";

export type ChipSelectOption = {
  value: string;
  label: string;
};

type ChipSelectProps = {
  "aria-label"?: string;
  autoFocus?: boolean;
  disabled?: boolean;
  options: ChipSelectOption[];
  placeholder: string;
  value: string;
  onBlur?: () => void;
  onChange: (value: string) => void;
};

const ChipSelect = ({
  "aria-label": ariaLabel,
  autoFocus = false,
  disabled = false,
  options,
  placeholder,
  value,
  onBlur,
  onChange,
}: ChipSelectProps) => (
  <select
    aria-label={ariaLabel}
    autoFocus={autoFocus}
    className={styles.chipSelect}
    disabled={disabled}
    onBlur={onBlur}
    onChange={(event) => onChange(event.target.value)}
    value={value}
  >
    <option value="">{placeholder}</option>
    {options.map((option) => (
      <option key={option.value} value={option.value}>
        {option.label}
      </option>
    ))}
  </select>
);

export default ChipSelect;
