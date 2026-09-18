import styles from "../dashboard.shared.module.css";

type RangeSelectorValue = string | number;

type RangeSelectorOption<TValue extends RangeSelectorValue> = {
  label: string;
  value: TValue;
};

type RangeSelectorProps<TValue extends RangeSelectorValue> = {
  label: string;
  value: TValue;
  options: Array<RangeSelectorOption<TValue>>;
  onChange: (value: TValue) => void;
  layout?: "stacked" | "inline";
};

const RangeSelector = <TValue extends RangeSelectorValue>({
  label,
  value,
  options,
  onChange,
  layout = "stacked",
}: RangeSelectorProps<TValue>) => (
  <label
    className={`${styles.rangeSelector} ${
      layout === "inline" ? styles.rangeSelectorInline : ""
    }`}
  >
    <span>{label}</span>
    <select
      onChange={(event) => {
        const selectedOption = options.find(
          (option) => String(option.value) === event.target.value,
        );

        if (selectedOption) {
          onChange(selectedOption.value);
        }
      }}
      value={String(value)}
    >
      {options.map((option) => (
        <option key={String(option.value)} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  </label>
);

export default RangeSelector;
