import { useEffect, useId, useRef, useState } from "react";

import type { ChipSelectOption } from "./ChipSelect";
import styles from "./EditableChipSelect.module.css";

type EditableChipSelectProps = {
  "aria-label"?: string;
  disabled?: boolean;
  options: ChipSelectOption[];
  placeholder: string;
  value: string;
  getDisplayLabel?: (label: string) => string;
  showPlaceholderOption?: boolean;
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
  showPlaceholderOption = true,
  onChange,
}: EditableChipSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectedOptionRef = useRef<HTMLButtonElement | null>(null);
  const generatedId = useId();
  const displayLabel = getDisplayLabel(
    getSelectedOptionLabel(options, value, placeholder),
  );
  const listboxId = `${generatedId}-options`;

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      selectedOptionRef.current?.focus();
    }
  }, [isOpen]);

  const selectValue = (nextValue: string) => {
    setIsOpen(false);
    onChange(nextValue);
  };

  return (
    <div className={styles.chipMenu} ref={containerRef}>
      <button
        aria-controls={isOpen ? listboxId : undefined}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className={styles.chipButton}
        disabled={disabled}
        type="button"
        onClick={() => setIsOpen((current) => !current)}
      >
        {displayLabel}
      </button>
      {isOpen && (
        <div
          aria-label={ariaLabel}
          className={styles.optionMenu}
          id={listboxId}
          role="listbox"
        >
          {showPlaceholderOption && (
            <button
            aria-selected={value === ""}
            className={styles.optionButton}
            ref={value === "" ? selectedOptionRef : undefined}
            role="option"
            type="button"
            onClick={() => selectValue("")}
            >
              {placeholder}
            </button>
          )}
          {options.map((option) => (
            <button
              aria-selected={option.value === value}
              className={styles.optionButton}
              key={option.value}
              ref={option.value === value ? selectedOptionRef : undefined}
              role="option"
              type="button"
              onClick={() => selectValue(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditableChipSelect;
