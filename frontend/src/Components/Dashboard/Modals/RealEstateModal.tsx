import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteRequest,
  getJson,
  postJson,
  putJson,
} from "../../../shared/apiClient";
import { dashboardPayloadKeys, resourceKeys } from "../dashboardQueryKeys";
import { formatCurrency, formatDate } from "../shared/formatters";
import { removeById, upsertById } from "../shared/queryCache";
import { useReportedQueryError } from "../shared/useReportedQueryError";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import ModalActionButton from "./ModalActionButton";
import ModalShell from "./ModalShell";
import {
  useAddressSuggestions,
  type AddressSuggestion,
} from "./useAddressSuggestions";

type Property = {
  id: number;
  address: string;
  loan_original_amount: number | null;
  loan_annual_interest_rate: number | null;
  loan_monthly_payment: number | null;
  loan_balance_start_month: string | null;
  valuation_month: string | null;
  estimated_value: number | null;
  loan_balance: number | null;
  net_value: number | null;
};

type RealEstateModalProps = {
  onClose: () => void;
  onError: (message: string) => void;
};

type PropertiesResponse = {
  properties?: Property[];
};

type PropertyResponse = {
  property: Property;
};

const getCurrentMonth = () => {
  const date = new Date();

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
};

const getMonthInputValue = (value: string | null) => {
  if (!value) {
    return getCurrentMonth();
  }

  return value.slice(0, 7);
};

const normalizeCurrencyInput = (value: string) => {
  const strippedValue = value.replace(/,/g, "").replace(/[^\d.]/g, "");
  const [wholeValue, ...decimalParts] = strippedValue.split(".");
  const decimalValue = decimalParts.join("").slice(0, 2);

  if (decimalParts.length === 0) {
    return wholeValue;
  }

  return `${wholeValue || "0"}.${decimalValue}`;
};

const formatCurrencyInput = (value: string) => {
  if (!value) {
    return "";
  }

  const [wholeValue, decimalValue] = value.split(".");
  const formattedWholeValue = (wholeValue || "0").replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ",",
  );

  return decimalValue === undefined
    ? formattedWholeValue
    : `${formattedWholeValue}.${decimalValue}`;
};

const sortProperties = (items: Property[]) =>
  [...items].sort((first, second) =>
    first.address.localeCompare(second.address),
  );

const RealEstateModal = ({ onClose, onError }: RealEstateModalProps) => {
  const [address, setAddress] = useState("");
  const [loanBalance, setLoanBalance] = useState("");
  const [annualInterestRate, setAnnualInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [loanBalanceStartMonth, setLoanBalanceStartMonth] =
    useState(getCurrentMonth);
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(
    null,
  );
  const [deletingPropertyId, setDeletingPropertyId] = useState<number | null>(
    null,
  );
  const [isAddressMenuOpen, setIsAddressMenuOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const queryClient = useQueryClient();
  const {
    suggestions: addressSuggestions,
    status: addressSearchStatus,
    isSearching: isSearchingAddresses,
  } = useAddressSuggestions(address, !selectedAddressId);

  const resetForm = () => {
    setAddress("");
    setLoanBalance("");
    setAnnualInterestRate("");
    setMonthlyPayment("");
    setLoanBalanceStartMonth(getCurrentMonth());
    setEditingPropertyId(null);
    setSelectedAddressId(null);
    setIsAddressMenuOpen(false);
  };

  const propertiesQuery = useQuery({
    queryKey: resourceKeys.properties,
    queryFn: async () => {
      const data = await getJson<PropertiesResponse>(
        "/api/properties",
        {},
        "Property request failed",
      );

      return sortProperties(data.properties || []);
    },
  });

  const savePropertyMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        address: address.trim(),
        loan_original_amount: Number(loanBalance),
        loan_annual_interest_rate: Number(annualInterestRate),
        loan_monthly_payment: Number(monthlyPayment),
        loan_balance_start_month: `${loanBalanceStartMonth}-01`,
      };

      return editingPropertyId === null
        ? postJson<PropertyResponse>(
            "/api/properties",
            payload,
            {},
            "Property save failed",
          )
        : putJson<PropertyResponse>(
            `/api/properties/${editingPropertyId}`,
            payload,
            {},
            "Property update failed",
          );
    },
    onSuccess: async (data) => {
      queryClient.setQueryData<Property[]>(
        resourceKeys.properties,
        (currentProperties) =>
          upsertById(currentProperties, data.property, (a, b) =>
            a.address.localeCompare(b.address),
          ),
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
      resetForm();
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save real estate",
      );
    },
  });

  const deletePropertyMutation = useMutation({
    mutationFn: (property: Property) =>
      deleteRequest(
        `/api/properties/${property.id}`,
        {},
        "Property delete failed",
      ),
    onSuccess: async (_data, property) => {
      queryClient.setQueryData<Property[]>(
        resourceKeys.properties,
        (currentProperties) => removeById(currentProperties, property.id),
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });

      if (editingPropertyId === property.id) {
        resetForm();
      }
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete real estate",
      );
    },
    onSettled: () => setDeletingPropertyId(null),
  });

  const properties = propertiesQuery.data || [];
  const canSave = useMemo(() => {
    const numericFields = [loanBalance, annualInterestRate, monthlyPayment].map(
      (value) => Number(value),
    );

    return (
      address.trim().length > 0 &&
      loanBalanceStartMonth.length === 7 &&
      numericFields.every((value) => Number.isFinite(value) && value >= 0) &&
      !savePropertyMutation.isPending &&
      deletingPropertyId === null
    );
  }, [
    address,
    annualInterestRate,
    deletingPropertyId,
    loanBalance,
    loanBalanceStartMonth,
    monthlyPayment,
    savePropertyMutation.isPending,
  ]);

  useReportedQueryError(
    propertiesQuery.error,
    "Unable to load real estate",
    onError,
  );

  const updateAddress = (value: string) => {
    setAddress(value);
    setSelectedAddressId(null);
    setIsAddressMenuOpen(true);
  };

  const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setSelectedAddressId(suggestion.id);
    setIsAddressMenuOpen(false);
  };

  const editProperty = (property: Property) => {
    setAddress(property.address);
    setLoanBalance(String(property.loan_original_amount ?? ""));
    setAnnualInterestRate(String(property.loan_annual_interest_rate ?? ""));
    setMonthlyPayment(String(property.loan_monthly_payment ?? ""));
    setLoanBalanceStartMonth(
      getMonthInputValue(property.loan_balance_start_month),
    );
    setEditingPropertyId(property.id);
    setSelectedAddressId(`property-${property.id}`);
    setIsAddressMenuOpen(false);
  };

  const saveProperty = () => {
    if (!canSave) {
      return;
    }

    savePropertyMutation.mutate();
  };

  const deleteProperty = (property: Property) => {
    if (!window.confirm(`Remove ${property.address}?`)) {
      return;
    }

    setDeletingPropertyId(property.id);
    deletePropertyMutation.mutate(property);
  };

  return (
    <ModalShell ariaLabel="Real estate" onClose={onClose}>
      <div className={styles.modalHeader}>
        <div>
          <h2>Real estate</h2>
        </div>
        <button type="button" onClick={onClose}>
          Close
        </button>
      </div>

      <form
        className={styles.realEstateForm}
        onSubmit={(event) => {
          event.preventDefault();
          saveProperty();
        }}
      >
        <label className={styles.realEstateAddressField}>
          <span>Address</span>
          <div className={styles.addressSearchField}>
            <input
              aria-autocomplete="list"
              aria-controls="real-estate-address-suggestions"
              aria-expanded={isAddressMenuOpen}
              autoComplete="off"
              onBlur={() => {
                window.setTimeout(() => setIsAddressMenuOpen(false), 100);
              }}
              onChange={(event) => updateAddress(event.target.value)}
              onFocus={() => {
                setIsAddressMenuOpen(addressSuggestions.length > 0);
              }}
              placeholder="123 Main St, San Francisco, CA"
              role="combobox"
              type="text"
              value={address}
            />
            {isAddressMenuOpen && addressSuggestions.length > 0 && (
              <div
                className={styles.addressSuggestionList}
                id="real-estate-address-suggestions"
                role="listbox"
              >
                {addressSuggestions.map((suggestion) => (
                  <button
                    className={styles.addressSuggestionOption}
                    key={suggestion.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      selectAddressSuggestion(suggestion);
                    }}
                    role="option"
                    type="button"
                  >
                    <strong>{suggestion.address}</strong>
                    <span>
                      {[
                        suggestion.city,
                        suggestion.region,
                        suggestion.postal_code,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <small className={styles.addressSearchStatus}>
            {isSearchingAddresses
              ? "Searching addresses..."
              : addressSearchStatus}
          </small>
        </label>
        <label>
          <span>Loan balance</span>
          <input
            inputMode="decimal"
            onChange={(event) =>
              setLoanBalance(normalizeCurrencyInput(event.target.value))
            }
            placeholder="650,000"
            type="text"
            value={formatCurrencyInput(loanBalance)}
          />
        </label>
        <label>
          <span>Annual rate %</span>
          <input
            min="0"
            onChange={(event) => setAnnualInterestRate(event.target.value)}
            placeholder="6.25"
            step="0.001"
            type="number"
            value={annualInterestRate}
          />
        </label>
        <label>
          <span>Monthly payment</span>
          <input
            inputMode="decimal"
            onChange={(event) =>
              setMonthlyPayment(normalizeCurrencyInput(event.target.value))
            }
            placeholder="4,100"
            type="text"
            value={formatCurrencyInput(monthlyPayment)}
          />
        </label>
        <label>
          <span>Balance as of</span>
          <input
            onChange={(event) => setLoanBalanceStartMonth(event.target.value)}
            type="month"
            value={loanBalanceStartMonth}
          />
        </label>
        <div className={styles.realEstateFormActions}>
          {editingPropertyId !== null && (
            <button
              disabled={
                savePropertyMutation.isPending || deletingPropertyId !== null
              }
              onClick={resetForm}
              type="button"
            >
              Cancel
            </button>
          )}
          <button type="submit" disabled={!canSave}>
            {savePropertyMutation.isPending
              ? "Saving"
              : editingPropertyId === null
                ? "Save property"
                : "Update property"}
          </button>
        </div>
      </form>

      <div className={styles.propertyList}>
        {propertiesQuery.isLoading ? (
          <p className={shared.emptyText}>Loading real estate...</p>
        ) : properties.length === 0 ? (
          <p className={shared.emptyText}>No real estate yet.</p>
        ) : (
          properties.map((property) => (
            <article className={styles.propertyCard} key={property.id}>
              <div className={styles.propertyCardHeader}>
                <div>
                  <h3>{property.address}</h3>
                  <p>
                    {property.valuation_month
                      ? `Valued ${formatDate(property.valuation_month)}`
                      : "No valuation yet"}
                  </p>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Value</dt>
                  <dd>{formatCurrency(property.estimated_value)}</dd>
                </div>
                <div>
                  <dt>Loan</dt>
                  <dd>{formatCurrency(property.loan_balance)}</dd>
                </div>
                <div>
                  <dt>Equity</dt>
                  <dd>{formatCurrency(property.net_value)}</dd>
                </div>
              </dl>
              <div className={styles.modalRowActions}>
                <ModalActionButton onClick={() => editProperty(property)}>
                  Edit
                </ModalActionButton>
                <ModalActionButton
                  disabled={deletingPropertyId === property.id}
                  onClick={() => deleteProperty(property)}
                  variant="danger"
                >
                  {deletingPropertyId === property.id ? "Removing" : "Remove"}
                </ModalActionButton>
              </div>
            </article>
          ))
        )}
      </div>
    </ModalShell>
  );
};

export default RealEstateModal;
