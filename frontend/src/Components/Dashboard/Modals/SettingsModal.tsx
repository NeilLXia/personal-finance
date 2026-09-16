import { useState } from "react";

import styles from "./index.module.css";
import { BudgetTargetsPanel } from "./BudgetTargetsModal";
import { CategoryRulesPanel } from "./CategoryRulesModal";
import { CreditCardTypesPanel } from "./CreditCardTypesModal";
import ModalShell from "./ModalShell";
import type {
  CreateCreditCardTypeInput,
  CreditCardType,
} from "../../CreditCardRewards/types";

type SettingsTab = "category-rules" | "budget-targets" | "card-types";

type SettingsModalProps = {
  onClose: () => void;
  onError: (message: string) => void;
  cardTypes: CreditCardType[];
  isCardTypeManager: boolean;
  isImportingVectorMintCards: boolean;
  isSavingCardType: boolean;
  isDeletingCardType: boolean;
  onCreateCardType: (input: CreateCreditCardTypeInput) => Promise<unknown>;
  onUpdateCardType: (params: {
    cardTypeId: number;
    input: CreateCreditCardTypeInput;
  }) => Promise<unknown>;
  onDeleteCardType: (cardTypeId: number) => Promise<unknown>;
  onImportVectorMintCards: () => Promise<unknown>;
};

const baseSettingsTabs: Array<{ label: string; value: SettingsTab }> = [
  { label: "Category rules", value: "category-rules" },
  { label: "Budget targets", value: "budget-targets" },
];

const SettingsModal = ({
  onClose,
  onError,
  cardTypes,
  isCardTypeManager,
  isImportingVectorMintCards,
  isSavingCardType,
  isDeletingCardType,
  onCreateCardType,
  onUpdateCardType,
  onDeleteCardType,
  onImportVectorMintCards,
}: SettingsModalProps) => {
  const [activeTab, setActiveTab] = useState<SettingsTab>("category-rules");
  const settingsTabs = isCardTypeManager
    ? [...baseSettingsTabs, { label: "Card types", value: "card-types" as const }]
    : baseSettingsTabs;

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
          ) : activeTab === "budget-targets" ? (
            <BudgetTargetsPanel onError={onError} />
          ) : (
            <CreditCardTypesPanel
              cardTypes={cardTypes}
              isDeleting={isDeletingCardType}
              isImportingVectorMintCards={isImportingVectorMintCards}
              isSaving={isSavingCardType}
              onCreateCardType={onCreateCardType}
              onUpdateCardType={onUpdateCardType}
              onDeleteCardType={onDeleteCardType}
              onImportVectorMintCards={onImportVectorMintCards}
            />
          )}
        </section>
      </div>
    </ModalShell>
  );
};

export default SettingsModal;
