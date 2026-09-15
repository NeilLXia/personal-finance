import { useState } from "react";

import ChipSelect from "./ChipSelect";
import type { ChipSelectOption } from "./ChipSelect";
import styles from "./EditableChipSelect.module.css";

type EditableChipSelectProps = {
  "aria-label"?: string;
  disabled?: boolean;
  options: ChipSelectOption[];
  placeholder: string;
  value: string;
  getDisplayLabel?: (label: string) => string;
  onChange: (value: string) => void;
};

const getSelectedOptionLabel = (
  options: ChipSelectOption[],
  value: string,
  placeholder: string,
) => options.find((option) => option.value === value)?.label || placeholder;

const EditableChipSelect = ({
  "aria-label": ariaLabel,
  disabled = false,
  options,
  placeholder,
  value,
  getDisplayLabel = (label) => label,
  onChange,
}: EditableChipSelectProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const displayLabel = getDisplayLabel(
    getSelectedOptionLabel(options, value, placeholder),
  );

  if (isEditing) {
    return (
      <ChipSelect
        aria-label={ariaLabel}
        autoFocus
        disabled={disabled}
        options={options}
        placeholder={placeholder}
        value={value}
        onBlur={() => setIsEditing(false)}
        onChange={(nextValue) => {
          setIsEditing(false);
          onChange(nextValue);
        }}
      />
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={styles.chipButton}
      disabled={disabled}
      type="button"
      onClick={() => setIsEditing(true)}
    >
      {displayLabel}
    </button>
  );
};

export default EditableChipSelect;
