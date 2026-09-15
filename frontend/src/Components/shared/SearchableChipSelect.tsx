import { useEffect, useId, useMemo, useRef, useState } from "react";

import type { ChipSelectOption } from "./ChipSelect";
import styles from "./SearchableChipSelect.module.css";

type SearchableChipSelectProps = {
  "aria-label"?: string;
  disabled?: boolean;
  options: ChipSelectOption[];
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
};

const normalizeSearchText = (value: string) => value.trim().toLowerCase();

const getSelectedOptionLabel = (
  options: ChipSelectOption[],
  value: string,
  placeholder: string,
) => options.find((option) => option.value === value)?.label || placeholder;

const SearchableChipSelect = ({
  "aria-label": ariaLabel,
  disabled = false,
  options,
  placeholder,
  value,
  onChange,
}: SearchableChipSelectProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const [searchValue, setSearchValue] = useState(() =>
    getSelectedOptionLabel(options, value, placeholder),
  );
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const filteredOptions = useMemo(() => {
    const query = normalizeSearchText(searchValue);

    if (!query || searchValue === placeholder) {
      return options;
    }

    return options.filter((option) =>
      normalizeSearchText(option.label).includes(query),
    );
  }, [options, placeholder, searchValue]);

  useEffect(() => {
    if (!isOpen) {
      setSearchValue(getSelectedOptionLabel(options, value, placeholder));
    }
  }, [isOpen, options, placeholder, value]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchValue]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);

    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isOpen]);

  const selectValue = (nextValue: string) => {
    onChange(nextValue);
    setIsOpen(false);
    setSearchValue(getSelectedOptionLabel(options, nextValue, placeholder));
  };

  return (
    <div className={styles.searchableChipSelect} ref={containerRef}>
      <input
        aria-activedescendant={
          isOpen && filteredOptions[highlightedIndex]
            ? `${inputId}-option-${filteredOptions[highlightedIndex].value}`
            : undefined
        }
        aria-autocomplete="list"
        aria-controls={`${inputId}-listbox`}
        aria-expanded={isOpen}
        aria-label={ariaLabel}
        className={styles.searchInput}
        disabled={disabled}
        role="combobox"
        type="text"
        value={searchValue}
        onChange={(event) => {
          setSearchValue(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => {
          setSearchValue("");
          setIsOpen(true);
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((index) =>
              filteredOptions.length === 0
                ? 0
                : Math.min(index + 1, filteredOptions.length - 1),
            );
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setHighlightedIndex((index) => Math.max(index - 1, 0));
          } else if (event.key === "Enter") {
            event.preventDefault();
            if (isOpen && filteredOptions[highlightedIndex]) {
              selectValue(filteredOptions[highlightedIndex].value);
            }
          } else if (event.key === "Escape") {
            setIsOpen(false);
          }
        }}
      />

      {isOpen && (
        <ul
          className={styles.listbox}
          id={`${inputId}-listbox`}
          role="listbox"
        >
          <li
            className={`${styles.option} ${
              value === "" ? styles.optionSelected : ""
            }`}
            role="option"
            aria-selected={value === ""}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectValue("")}
          >
            {placeholder}
          </li>
          {filteredOptions.length === 0 ? (
            <li className={`${styles.option} ${styles.emptyOption}`}>
              No card types found
            </li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                aria-selected={option.value === value}
                className={`${styles.option} ${
                  index === highlightedIndex ? styles.optionHighlighted : ""
                } ${option.value === value ? styles.optionSelected : ""}`}
                id={`${inputId}-option-${option.value}`}
                key={option.value}
                role="option"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectValue(option.value)}
                onMouseEnter={() => setHighlightedIndex(index)}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchableChipSelect;
