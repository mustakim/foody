import { Receipt } from "lucide-react";
import { useState } from "react";
import { formatMoney, roundMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useMealEntries } from "../meals/useMeals";
import { receiptsOf } from "./receiptsApi";
import { ReceiptLinks, ReceiptPicker } from "./Receipts";
import { useAttachReceipts, useChargeDay, useExpenseForDate } from "./useExpenses";

// Admin-only: enter what a day's meal cost and split it across that day's sign-ups.
export function ChargeDayForm({ enteredByName, expenseDate }: { enteredByName: string; expenseDate: string }) {
  const { t } = useT();
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const expense = useExpenseForDate(expenseDate);
  const entries = useMealEntries(expenseDate);
  const charge = useChargeDay();
  const attach = useAttachReceipts();

  const headCount = (entries.data ?? []).filter((entry) => !entry.IsCharged).length;
  const amount = Number(total);
  const perHead = headCount > 0 && amount > 0 ? roundMoney(amount / headCount) : 0;

  if (expense.isLoading || entries.isLoading) return <Skeleton className="skeleton-line" />;

  if (expense.data) {
    return (
      <div className="charge-summary">
        <div><span>{t("expenses.total")}</span><strong>{formatMoney(Number(expense.data.TotalAmount ?? 0))}</strong></div>
        <div><span>{t("expenses.people")}</span><strong>{expense.data.HeadCount ?? 0}</strong></div>
        <div><span>{t("expenses.perHead")}</span><strong>{formatMoney(Number(expense.data.PerHeadAmount ?? 0))}</strong></div>
        <p className="muted">{t("expenses.alreadyCharged")}{expense.data.EnteredByName ? ` (${expense.data.EnteredByName})` : ""}</p>
        <div className="charge-summary-wide">
          <ReceiptLinks receipts={receiptsOf(expense.data)} />
          <ReceiptPicker disabled={attach.isPending} files={files} onChange={setFiles} />
          {files.length > 0 ? (
            <div className="form-actions">
              <ActionButton
                disabled={attach.isPending}
                onClick={() => expense.data && attach.mutate({ expense: expense.data, files }, { onSuccess: () => setFiles([]) })}
              >
                {attach.isPending ? t("receipts.uploading") : t("receipts.save")}
              </ActionButton>
            </div>
          ) : null}
          {attach.error ? <Alert tone="error">{attach.error.message}</Alert> : null}
        </div>
      </div>
    );
  }

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        charge.mutate({ enteredByName, expenseDate, files, note, totalAmount: amount }, { onSuccess: () => { setTotal(""); setNote(""); setFiles([]); } });
      }}
    >
      <FormField label={t("expenses.totalCost")} type="number" min="0" step="0.01" inputMode="decimal" required value={total} onChange={(event) => setTotal(event.target.value)} />
      <FormField label={t("expenses.note")} placeholder={t("expenses.notePlaceholder")} value={note} onChange={(event) => setNote(event.target.value)} />
      <div className="form-span"><ReceiptPicker disabled={charge.isPending} files={files} onChange={setFiles} /></div>
      <div className="form-actions">
        <span className="muted">
          {headCount === 0 ? t("expenses.noSignups") : `${headCount} ${t("expenses.people").toLowerCase()} × ${formatMoney(perHead)}`}
        </span>
        <ActionButton type="submit" disabled={charge.isPending || headCount === 0 || !(amount > 0)} icon={<Receipt size={18} />}>
          {charge.isPending ? t("common.loading") : t("expenses.charge")}
        </ActionButton>
      </div>
      {charge.error ? <div className="form-span"><Alert tone="error">{charge.error.message}</Alert></div> : null}
    </form>
  );
}
