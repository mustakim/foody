import { useState } from "react";
import { todayKey } from "../meals/mealsApi";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { useAddCredit } from "./useLedger";

export function CreditDialog({ enteredByName, member, onClose }: { enteredByName: string; member: { userId: string; userName: string }; onClose: () => void }) {
  const { t } = useT();
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const addCredit = useAddCredit();

  return (
    <Modal title={`${t("members.addCredit")}: ${member.userName}`} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          addCredit.mutate(
            { ...member, amount: Number(amount), enteredByName, entryDate: todayKey(), note },
            { onSuccess: onClose }
          );
        }}
      >
        <FormField autoFocus label={t("members.amount")} type="number" min="0.01" step="0.01" inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
        <FormField label={t("expenses.note")} placeholder={t("members.creditNotePlaceholder")} value={note} onChange={(event) => setNote(event.target.value)} />
        {addCredit.error ? <Alert tone="error">{addCredit.error.message}</Alert> : null}
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <ActionButton type="submit" disabled={addCredit.isPending || !(Number(amount) > 0)}>
            {addCredit.isPending ? t("common.loading") : t("members.addCredit")}
          </ActionButton>
        </div>
      </form>
    </Modal>
  );
}
