import styles from "./ChipSelector.module.css";

export type ChipSelectorOption = {
  value: string;
  label: string;
  detail?: string;
  disabled?: boolean;
};

type ChipSelectorProps = {
  ariaLabel: string;
  options: ChipSelectorOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
};

const ChipSelector = ({
  ariaLabel,
  options,
  selectedValues,
  onToggle,
}: ChipSelectorProps) => {
  const selectedValueSet = new Set(selectedValues);

  return (
    <div aria-label={ariaLabel} className={styles.chipGroup} role="group">
      {options.map((option) => {
        const isSelected = selectedValueSet.has(option.value);

        return (
          <button
            aria-pressed={isSelected}
            className={isSelected ? styles.chipActive : styles.chip}
            disabled={option.disabled}
            key={option.value}
            type="button"
            onClick={() => onToggle(option.value)}
          >
            <span>{option.label}</span>
            {option.detail && <strong>{option.detail}</strong>}
          </button>
        );
      })}
    </div>
  );
};

export default ChipSelector;
