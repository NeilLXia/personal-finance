import styles from "./index.module.css";
import { useTheme, type ThemePreference } from "./useTheme";

const LABELS: Record<ThemePreference, { icon: string; text: string }> = {
  system: { icon: "◐", text: "System" },
  light: { icon: "☀", text: "Light" },
  dark: { icon: "☾", text: "Dark" },
};

const ThemeToggle = () => {
  const { theme, cycleTheme } = useTheme();
  const { icon, text } = LABELS[theme];

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={cycleTheme}
      aria-label={`Theme: ${text}. Click to change.`}
      title={`Theme: ${text}`}
    >
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.label}>{text}</span>
    </button>
  );
};

export default ThemeToggle;
