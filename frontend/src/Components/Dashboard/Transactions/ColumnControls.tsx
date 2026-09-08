import styles from "./index.module.css";

type ColumnControlsProps<TColumn extends string> = {
  columns: TColumn[];
  searchTerms: Record<TColumn, string>;
  sortColumn: TColumn;
  sortDirection: "asc" | "desc";
  summary: Record<TColumn, string>;
  className?: string;
  getInputType?: (column: TColumn) => "date" | "search";
  onSearchTermsChange: (searchTerms: Record<TColumn, string>) => void;
  onSortColumnChange: (column: TColumn) => void;
};

const formatColumnLabel = (column: string) =>
  column.charAt(0).toUpperCase() + column.slice(1);

const ColumnControls = <TColumn extends string>({
  columns,
  searchTerms,
  sortColumn,
  sortDirection,
  summary,
  className = "",
  getInputType = () => "search",
  onSearchTermsChange,
  onSortColumnChange,
}: ColumnControlsProps<TColumn>) => (
  <div className={`${styles.transactionTableControls} ${className}`.trim()}>
    {columns.map((column) => (
      <label
        className={`${styles.transactionColumnControl} ${
          sortColumn === column || searchTerms[column]
            ? styles.transactionColumnControlActive
            : ""
        }`}
        key={column}
      >
        <button type="button" onClick={() => onSortColumnChange(column)}>
          <span>{formatColumnLabel(column)}</span>
          {sortColumn === column && (
            <span
              className={`${styles.sortCaret} ${
                sortDirection === "asc" ? styles.sortCaretAscending : ""
              }`}
              aria-hidden="true"
            />
          )}
        </button>
        <input
          onChange={(event) =>
            onSearchTermsChange({
              ...searchTerms,
              [column]: event.target.value,
            })
          }
          placeholder={summary[column]}
          type={getInputType(column)}
          value={searchTerms[column]}
        />
      </label>
    ))}
  </div>
);

export default ColumnControls;
