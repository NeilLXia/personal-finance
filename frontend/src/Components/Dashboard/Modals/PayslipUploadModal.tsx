import { useEffect, useMemo, useState } from "react";

import { getJson, postFormData } from "../../../shared/apiClient";
import { formatCurrency, formatDate } from "../shared/formatters";
import styles from "./index.module.css";
import shared from "../dashboard.shared.module.css";
import type { Payslip, PayslipUpload } from "../shared/types";
import ModalShell from "./ModalShell";

type PayslipUploadModalProps = {
  onClose: () => void;
  onError: (message: string) => void;
};

type PayslipsResponse = {
  payslips?: Payslip[];
};

type PayslipUploadResponse = {
  upload: PayslipUpload;
  payslips?: Payslip[];
};

const PayslipUploadModal = ({ onClose, onError }: PayslipUploadModalProps) => {
  const [payslips, setPayslips] = useState<Payslip[]>([]);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUpload, setLastUpload] = useState<PayslipUpload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);

  const sortedPayslips = useMemo(
    () =>
      [...payslips].sort(
        (firstPayslip, secondPayslip) =>
          new Date(secondPayslip.check_date).getTime() -
          new Date(firstPayslip.check_date).getTime(),
      ),
    [payslips],
  );

  useEffect(() => {
    let isMounted = true;

    const loadPayslips = async () => {
      setIsLoading(true);

      try {
        const data = await getJson<PayslipsResponse>(
          "/api/payslips",
          {},
          "Payslip request failed",
        );
        if (isMounted) {
          setPayslips(data.payslips || []);
        }
      } catch (requestError) {
        onError(
          requestError instanceof Error
            ? requestError.message
            : "Unable to load payslips",
        );
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void loadPayslips();

    return () => {
      isMounted = false;
    };
  }, [onError]);

  const uploadPayslip = async () => {
    if (!selectedFile || isUploading) {
      return;
    }

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("payslip_pdf", selectedFile);

      const data = await postFormData<PayslipUploadResponse>(
        "/api/payslips/upload",
        formData,
        {},
        "Payslip upload failed",
      );
      setLastUpload(data.upload);
      setPayslips((currentPayslips) => {
        const payslipsById = new Map<number, Payslip>();
        [...(data.payslips || []), ...currentPayslips].forEach((payslip) => {
          payslipsById.set(payslip.id, payslip);
        });

        return Array.from(payslipsById.values());
      });
      setSelectedFile(null);
    } catch (requestError) {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload payslip",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <ModalShell ariaLabel="Payslip upload" onClose={onClose}>
        <div className={styles.modalHeader}>
          <div>
            <h2>Payslips</h2>
            <p>Upload payroll PDFs and import each parsed pay period.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <form
          className={styles.payslipUploadForm}
          onSubmit={(event) => {
            event.preventDefault();
            void uploadPayslip();
          }}
        >
          <label>
            <span>PDF file</span>
            <span className={styles.filePicker}>
              <span className={styles.filePickerButton}>Choose file</span>
              <span className={styles.filePickerName}>
                {selectedFile?.name || "No file chosen"}
              </span>
              <input
                accept="application/pdf"
                onChange={(event) =>
                  setSelectedFile(event.target.files?.[0] || null)
                }
                type="file"
              />
            </span>
          </label>
          <button type="submit" disabled={!selectedFile || isUploading}>
            {isUploading ? "Importing" : "Import payslip"}
          </button>
        </form>

        {lastUpload && (
          <div className={styles.payslipUploadSummary}>
            <strong>{lastUpload.original_filename}</strong>
            <span>
              {lastUpload.imported_count} imported, {lastUpload.skipped_count} skipped
              from {lastUpload.page_count} page
              {lastUpload.page_count === 1 ? "" : "s"}.
            </span>
          </div>
        )}

        <div className={styles.payslipList}>
          {isLoading ? (
            <p className={shared.emptyText}>Loading payslips</p>
          ) : sortedPayslips.length === 0 ? (
            <p className={shared.emptyText}>No payslips imported yet.</p>
          ) : (
            sortedPayslips.map((payslip) => (
              <article className={styles.payslipRow} key={payslip.id}>
                <div>
                  <strong>{formatDate(payslip.check_date)}</strong>
                  <span>
                    {formatDate(payslip.pay_period_begin)} -{" "}
                    {formatDate(payslip.pay_period_end)}
                  </span>
                </div>
                <div>
                  <strong>{payslip.employer_name || "Employer unavailable"}</strong>
                  <span>{payslip.hours_worked || "0"} hours</span>
                </div>
                <div>
                  <span>Gross {formatCurrency(payslip.gross_pay)}</span>
                  <span>
                    Taxes{" "}
                    {formatCurrency(
                      Number(payslip.social_security_tax || 0) +
                        Number(payslip.medicare_tax || 0) +
                        Number(payslip.federal_withholding_tax || 0) +
                        Number(payslip.state_tax || 0) +
                        Number(payslip.ca_disability_insurance_tax || 0),
                    )}
                  </span>
                </div>
                <div>
                  <span>Deductions {formatCurrency(
                    Number(payslip.pre_tax_deductions || 0) +
                      Number(payslip.post_tax_deductions || 0),
                  )}</span>
                  <strong>Net {formatCurrency(payslip.net_pay)}</strong>
                </div>
              </article>
            ))
          )}
        </div>
    </ModalShell>
  );
};

export default PayslipUploadModal;
