import { useMemo, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";

import { getJson, postFormData } from "../../../shared/apiClient";
import { dashboardPayloadKeys, resourceKeys } from "../dashboardQueryKeys";
import { formatCurrency, formatDate } from "../shared/formatters";
import { upsertManyById } from "../shared/queryCache";
import { useReportedQueryError } from "../shared/useReportedQueryError";
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

const byCheckDateDesc = (firstPayslip: Payslip, secondPayslip: Payslip) =>
  new Date(secondPayslip.check_date).getTime() -
  new Date(firstPayslip.check_date).getTime();

const sortPayslips = (payslips: Payslip[]) =>
  [...payslips].sort(byCheckDateDesc);

const PayslipUploadModal = ({ onClose, onError }: PayslipUploadModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [lastUpload, setLastUpload] = useState<PayslipUpload | null>(null);
  const queryClient = useQueryClient();
  const payslipsQuery = useQuery({
    queryKey: resourceKeys.payslips,
    queryFn: async () => {
      const data = await getJson<PayslipsResponse>(
        "/api/payslips",
        {},
        "Payslip request failed",
      );

      return data.payslips || [];
    },
  });
  const uploadPayslipMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("payslip_pdf", file);

      return postFormData<PayslipUploadResponse>(
        "/api/payslips/upload",
        formData,
        {},
        "Payslip upload failed",
      );
    },
    onSuccess: async (data) => {
      setLastUpload(data.upload);
      queryClient.setQueryData<Payslip[]>(
        resourceKeys.payslips,
        (currentPayslips) =>
          upsertManyById(currentPayslips, data.payslips || [], byCheckDateDesc),
      );
      await queryClient.invalidateQueries({
        queryKey: dashboardPayloadKeys.root,
      });
      setSelectedFile(null);
    },
    onError: (requestError) => {
      onError(
        requestError instanceof Error
          ? requestError.message
          : "Unable to upload payslip",
      );
    },
  });
  const sortedPayslips = useMemo(
    () => sortPayslips(payslipsQuery.data || []),
    [payslipsQuery.data],
  );

  useReportedQueryError(payslipsQuery.error, "Unable to load payslips", onError);

  const uploadPayslip = () => {
    if (!selectedFile || uploadPayslipMutation.isPending) {
      return;
    }

    uploadPayslipMutation.mutate(selectedFile);
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
          uploadPayslip();
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
        <button
          type="submit"
          disabled={!selectedFile || uploadPayslipMutation.isPending}
        >
          {uploadPayslipMutation.isPending ? "Importing" : "Import payslip"}
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
        {payslipsQuery.isLoading ? (
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
                <span>
                  Deductions{" "}
                  {formatCurrency(
                    Number(payslip.pre_tax_deductions || 0) +
                      Number(payslip.post_tax_deductions || 0),
                  )}
                </span>
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
