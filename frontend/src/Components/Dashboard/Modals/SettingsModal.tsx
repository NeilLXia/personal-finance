import { useState } from "react";

import styles from "./index.module.css";
import { BudgetTargetsPanel } from "./BudgetTargetsModal";
import { CategoryRulesPanel } from "./CategoryRulesModal";
import ModalShell from "./ModalShell";

type SettingsTab = "category-rules" | "budget-targets";

type SettingsModalProps = {
  onClose: () => void;
  onError: (message: string) => void;
};

const settingsTabs: Array<{ label: string; value: SettingsTab }> = [
  { label: "Category rules", value: "category-rules" },
  { label: "Budget targets", value: "budget-targets" },
];

const SettingsModal = ({ onClose, onError }: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("category-rules");

  return (
    <ModalShell
      ariaLabel="Settings"
      className={styles.settingsModal}
      onClose={onClose}
    >
      <div className={styles.modalHeader}>
        <div>
          <h2>Settings</h2>
          <p>Manage dashboard rules and targets.</p>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <div className={styles.settingsLayout}>
        <div
          className={styles.settingsTabList}
          aria-label="Settings sections"
          role="tablist"
        >
          {settingsTabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              className={
                activeTab === tab.value ? styles.settingsTabActive : undefined
              }
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              role="tab"
            >
              {tab.label}
            </button>
          ))}
        </div>

        <section className={styles.settingsPanel} role="tabpanel">
          {activeTab === "category-rules" ? (
            <CategoryRulesPanel onError={onError} />
          ) : (
            <BudgetTargetsPanel onError={onError} />
          )}
        </section>
      </div>
    </ModalShell>
  );
};

export default SettingsModal;
