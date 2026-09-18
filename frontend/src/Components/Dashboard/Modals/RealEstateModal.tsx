import { useEffect, useMemo, useRef, useState } from "react";

import {
  ApiError,
  deleteRequest,
  getJson,
  postJson,
  putJson,
} from "../../../shared/apiClient";
import { formatCurrency, formatDate } from "../shared/formatters";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import ModalActionButton from "./ModalActionButton";
import ModalShell from "./ModalShell";

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
  onChanged: () => void;
  onError: (message: string) => void;
};

type PropertiesResponse = {
  properties?: Property[];
};

type PropertyResponse = {
  property: Property;
};

type AddressSuggestion = {
  id: string;
  label: string;
  address: string;
  city: string | null;
  region: string | null;
  postal_code: string | null;
  country: string | null;
  source: "mapbox";
};

type AddressSuggestionsResponse = {
  suggestions?: AddressSuggestion[];
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
  const strippedValue = value.replace(/,/g, '').replace(/[^\d.]/g, '');
  const [wholeValue, ...decimalParts] = strippedValue.split('.');
  const decimalValue = decimalParts.join('').slice(0, 2);

  if (decimalParts.length === 0) {
    return wholeValue;
  }

  return `${wholeValue || '0'}.${decimalValue}`;
};

const formatCurrencyInput = (value: string) => {
  if (!value) {
    return '';
  }

  const [wholeValue, decimalValue] = value.split('.');
  const formattedWholeValue = (wholeValue || '0').replace(
    /\B(?=(\d{3})+(?!\d))/g,
    ',',
  );

  return decimalValue === undefined
    ? formattedWholeValue
    : `${formattedWholeValue}.${decimalValue}`;
};

const createSearchSessionToken = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

const RealEstateModal = ({
  onClose,
  onChanged,
  onError,
}: RealEstateModalProps) => {
  const [properties, setProperties] = useState<Property[]>([]);
  const [address, setAddress] = useState("");
  const [loanBalance, setLoanBalance] = useState("");
  const [annualInterestRate, setAnnualInterestRate] = useState("");
  const [monthlyPayment, setMonthlyPayment] = useState("");
  const [loanBalanceStartMonth, setLoanBalanceStartMonth] =
    useState(getCurrentMonth);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPropertyId, setEditingPropertyId] = useState<number | null>(
    null,
  );
  const [deletingPropertyId, setDeletingPropertyId] = useState<number | null>(
    null,
  );
  const [addressSuggestions, setAddressSuggestions] = useState<
    AddressSuggestion[]
  >([]);
  const [addressSearchStatus, setAddressSearchStatus] = useState("");
  const [isSearchingAddresses, setIsSearchingAddresses] = useState(false);
  const [isAddressMenuOpen, setIsAddressMenuOpen] = useState(false);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(
    null,
  );
  const addressSearchSessionToken = useRef(createSearchSessionToken());

  const canSave = useMemo(() => {
    const numericFields = [
      loanBalance,
      annualInterestRate,
      monthlyPayment,
    ].map((value) => Number(value));

    return (
      address.trim().length > 0 &&
      loanBalanceStartMonth.length === 7 &&
      numericFields.every((value) => Number.isFinite(value) && value >= 0) &&
      !isSaving &&
      deletingPropertyId === null
    );
  }, [
    address,
    annualInterestRate,
    deletingPropertyId,
    isSaving,
    loanBalance,
    loanBalanceStartMonth,
    monthlyPayment,
  ]);

  useEffect(() => {
    let isMounted = true;

    const loadProperties = async () => {
      setIsLoading(true);

      try {
        const data = await getJson<PropertiesResponse>(
          "/api/properties",
          {},
          "Property request failed",
        );
        if (isMounted) {
          setProperties(data.properties || []);
        }
      } catch (requestError) {
        onError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load real estate",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadProperties();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  useEffect(() => {
    const trimmedAddress = address.trim();

    if (trimmedAddress.length < 3 || selectedAddressId) {
      setAddressSuggestions([]);
      setAddressSearchStatus("");
      setIsSearchingAddresses(false);
      return;
    }

    const controller = new AbortController();
    const debounce = window.setTimeout(() => {
      setIsSearchingAddresses(true);
      setAddressSearchStatus("");

      const params = new URLSearchParams({
        query: trimmedAddress,
        session_token: addressSearchSessionToken.current,
      });

      getJson<AddressSuggestionsResponse>(
        `/api/address-suggestions?${params.toString()}`,
        { signal: controller.signal },
        "Address search failed",
      )
        .then((data) => {
          const suggestions = data.suggestions || [];

          setAddressSuggestions(suggestions);
          setIsAddressMenuOpen(suggestions.length > 0);
          setAddressSearchStatus(
            suggestions.length === 0 ? "No matching addresses found." : "",
          );
        })
        .catch((requestError) => {
          if (controller.signal.aborted) {
            return;
          }

          setAddressSuggestions([]);
          setIsAddressMenuOpen(false);
          setAddressSearchStatus(
            requestError instanceof ApiError && requestError.status === 400
              ? "Address search is not configured."
              : "Address search is unavailable.",
          );
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSearchingAddresses(false);
          }
        });
    }, 250);

    return () => {
      window.clearTimeout(debounce);
      controller.abort();
    };
  }, [address, selectedAddressId]);

  const updateAddress = (value: string) => {
    setAddress(value);
    setSelectedAddressId(null);
    setIsAddressMenuOpen(true);
  };

  const selectAddressSuggestion = (suggestion: AddressSuggestion) => {
    setAddress(suggestion.label);
    setSelectedAddressId(suggestion.id);
    setAddressSuggestions([]);
    setAddressSearchStatus("");
    setIsAddressMenuOpen(false);
  };

  const resetForm = () => {
    setAddress("");
    setLoanBalance("");
    setAnnualInterestRate("");
    setMonthlyPayment("");
    setLoanBalanceStartMonth(getCurrentMonth());
    setEditingPropertyId(null);
    setSelectedAddressId(null);
    setAddressSuggestions([]);
    setAddressSearchStatus("");
    setIsAddressMenuOpen(false);
    addressSearchSessionToken.current = createSearchSessionToken();
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
    setAddressSuggestions([]);
    setAddressSearchStatus("");
    setIsAddressMenuOpen(false);
  };

  const sortProperties = (items: Property[]) =>
    items.sort((first, second) => first.address.localeCompare(second.address));

  const saveProperty = async () => {
    if (!canSave) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        address: address.trim(),
        loan_original_amount: Number(loanBalance),
        loan_annual_interest_rate: Number(annualInterestRate),
        loan_monthly_payment: Number(monthlyPayment),
        loan_balance_start_month: `${loanBalanceStartMonth}-01`,
      };
      const data =
        editingPropertyId === null
          ? await postJson<PropertyResponse>(
              "/api/properties",
              payload,
              {},
              "Property save failed",
            )
          : await putJson<PropertyResponse>(
              `/api/properties/${editingPropertyId}`,
              payload,
              {},
              "Property update failed",
            );
      setProperties((currentProperties) => {
        const propertiesById = new Map<number, Property>();
        [...currentProperties, data.property].forEach((property) => {
          propertiesById.set(property.id, property);
        });

        return sortProperties(Array.from(propertiesById.values()));
      });
      resetForm();
      onChanged();
    } catch (requestError) {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to save real estate",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const deleteProperty = async (property: Property) => {
    if (!window.confirm(`Remove ${property.address}?`)) {
      return;
    }

    setDeletingPropertyId(property.id);

    try {
      await deleteRequest(
        `/api/properties/${property.id}`,
        {},
        "Property delete failed",
      );
      setProperties((currentProperties) =>
        currentProperties.filter(
          (currentProperty) => currentProperty.id !== property.id,
        ),
      );

      if (editingPropertyId === property.id) {
        resetForm();
      }

      onChanged();
    } catch (requestError) {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to delete real estate",
      );
    } finally {
      setDeletingPropertyId(null);
    }
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
            void saveProperty();
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
                        {[suggestion.city, suggestion.region, suggestion.postal_code]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <small className={styles.addressSearchStatus}>
              {isSearchingAddresses ? "Searching addresses..." : addressSearchStatus}
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
                type="button"
                onClick={resetForm}
                disabled={isSaving || deletingPropertyId !== null}
              >
                Cancel
              </button>
            )}
            <button type="submit" disabled={!canSave}>
              {isSaving
                ? "Saving"
                : editingPropertyId === null
                  ? "Save property"
                  : "Update property"}
            </button>
          </div>
        </form>

        <div className={styles.propertyList}>
          {isLoading ? (
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
                    variant="danger"
                    disabled={deletingPropertyId === property.id}
                    onClick={() => {
                      void deleteProperty(property);
                    }}
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
