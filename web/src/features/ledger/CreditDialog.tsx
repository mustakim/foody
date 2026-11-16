import { Trash2 } from "lucide-react";
import { useState } from "react";
import { formatMoney, itemId, roundMoney } from "../../lib/blocks/items";
import { todayKey } from "../meals/mealsApi";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { DateField } from "../../shared/ui/DateField";
import { FormField } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { balanceOf, signedAmount } from "./ledgerApi";
import type { LedgerEntry } from "./ledgerApi";
import { useAddAdjustment, useAddCredit, useDeleteLedgerEntry, useLedger } from "./useLedger";

type Mode = "advance" | "deduct" | "set";

// Admin-only money controls for one person: record advance paid, deduct
// money, or set the balance to an exact figure (saved as an adjustment for
// the difference). Mistaken advances/adjustments can be deleted from the list.
export function CreditDialog({ enteredByName, member, onClose }: { enteredByName: string; member: { userId: string; userName: string }; onClose: () => void }) {
  const { t } = useT();
  const [mode, setMode] = useState<Mode>("advance");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [entryDate, setEntryDate] = useState(todayKey());
  const [confirmDelete, setConfirmDelete] = useState<LedgerEntry | null>(null);
  const ledger = useLedger(member.userId);
  const addCredit = useAddCredit();
  const addAdjustment = useAddAdjustment();
  const remove = useDeleteLedgerEntry();

  const current = balanceOf(ledger.data ?? []);
  const value = Number(amount);
  const change = !(amount !== "" && Number.isFinite(value)) ? 0 : roundMoney(mode === "advance" ? value : mode === "deduct" ? -value : value - current);
  const valid = mode === "set" ? amount !== "" && change !== 0 : value > 0;
  const pending = addCredit.isPending || addAdjustment.isPending;
  const error = addCredit.error ?? addAdjustment.error ?? remove.error;
  const editable = (ledger.data ?? []).filter((entry) => entry.EntryType !== "charge");

  function submit() {
    const input = { ...member, enteredByName, entryDate };
    if (mode === "advance") addCredit.mutate({ ...input, amount: value, note }, { onSuccess: onClose });
    else addAdjustment.mutate({ ...input, amount: change, note }, { onSuccess: onClose });
  }

  return (
    <Modal title={`${t("money.title")}: ${member.userName}`} onClose={onClose}>
      <form className="dialog-form" onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <div className="segmented" role="radiogroup" aria-label={t("money.title")}>
          {(["advance", "deduct", "set"] as const).map((option) => (
            <button key={option} type="button" role="radio" aria-checked={mode === option} className={mode === option ? "segmented-on" : ""} onClick={() => setMode(option)}>
              {t(`money.${option}`)}
            </button>
          ))}
        </div>
        <FormField
          autoFocus
          label={mode === "set" ? t("money.newBalance") : t("members.amount")}
          type="number"
          min={mode === "set" ? undefined : "0.01"}
          step="0.01"
          inputMode="decimal"
          required
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
        />
        <DateField label={t("expenses.date")} type="date" max={todayKey()} required value={entryDate} onChange={(event) => setEntryDate(event.target.value)} />
        <FormField
          label={t("expenses.note")}
          placeholder={mode === "advance" ? t("members.creditNotePlaceholder") : t("money.notePlaceholder")}
          required={mode !== "advance"}
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
        <div className="charge-summary">
          <div><span>{t("money.current")}</span><strong className={current < 0 ? "amount-negative" : ""}>{ledger.isLoading ? "…" : formatMoney(current)}</strong></div>
          <div><span>{t("money.change")}</span><strong className={change < 0 ? "amount-negative" : change > 0 ? "amount-positive" : ""}>{change > 0 ? "+" : ""}{formatMoney(change)}</strong></div>
          <div><span>{t("money.after")}</span><strong className={current + change < 0 ? "amount-negative" : ""}>{formatMoney(roundMoney(current + change))}</strong></div>
        </div>
        {error ? <Alert tone="error">{error.message}</Alert> : null}
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <ActionButton type="submit" disabled={pending || ledger.isLoading || !valid}>
            {pending ? t("common.loading") : t(`money.save.${mode}`)}
          </ActionButton>
        </div>
      </form>

      {editable.length > 0 ? (
        <div className="money-entries">
          <span className="receipt-label">{t("money.entries")}</span>
          {editable.map((entry) => (
            <div key={itemId(entry)} className="people-row">
              <span className="money-entry-text">
                <strong>{entry.EntryType === "adjustment" ? t("balance.adjustment") : t("balance.credit")} · {entry.EntryDate}</strong>
                <small>{entry.Note || "—"}</small>
              </span>
              <span className={signedAmount(entry) < 0 ? "amount-negative" : "amount-positive"}>{signedAmount(entry) > 0 ? "+" : ""}{formatMoney(signedAmount(entry))}</span>
              {confirmDelete === entry ? (
                <ActionButton disabled={remove.isPending} onClick={() => remove.mutate(entry, { onSettled: () => setConfirmDelete(null) })}>
                  {remove.isPending ? t("common.loading") : t("money.confirmDelete")}
                </ActionButton>
              ) : (
                <ActionButton variant="icon" title={t("common.delete")} icon={<Trash2 size={16} />} onClick={() => setConfirmDelete(entry)}>{t("common.delete")}</ActionButton>
              )}
            </div>
          ))}
        </div>
      ) : null}
    </Modal>
  );
}
