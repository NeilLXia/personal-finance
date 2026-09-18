import styles from "../dashboard.shared.module.css";
import type { DateRange } from "./types";

type CustomDateRangeInputsProps = {
  value: DateRange;
  onChange: (value: DateRange) => void;
};

const CustomDateRangeInputs = ({
  value,
  onChange,
}: CustomDateRangeInputsProps) => (
  <div className={styles.customDateRange}>
    <label>
      Start
      <input
        type="date"
        max={value.endDate}
        value={value.startDate}
        onChange={(event) =>
          onChange({
            ...value,
            startDate: event.target.value,
          })
        }
      />
    </label>
    <label>
      End
      <input
        type="date"
        min={value.startDate}
        value={value.endDate}
        onChange={(event) =>
          onChange({
            ...value,
            endDate: event.target.value,
          })
        }
      />
    </label>
  </div>
);

export default CustomDateRangeInputs;
