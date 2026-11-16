import { Receipt, Search } from "lucide-react";
import { useState } from "react";
import { formatMoney, roundMoney, splitEvenly } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { Skeleton } from "../../shared/ui/Skeleton";
import type { MealEntry } from "../meals/mealsApi";
import { useMealEntries } from "../meals/useMeals";
import { useMembers } from "../members/useMembers";
import { userDisplayName } from "../profile/useCurrentUser";
import { receiptsOf } from "./receiptsApi";
import { ReceiptLinks, ReceiptPicker } from "./Receipts";
import { useAttachReceipts, useChargeDay, useExpenseForDate } from "./useExpenses";

type Person = { userId: string; userName: string; userEmail: string; entry?: MealEntry };

// Admin-only: enter what a day's meal cost, tick who ate from the full
// member list (that day's sign-ups start ticked), and split it evenly or
// with per-person amounts. Works for any past date too.
export function ChargeDayForm({ enteredByName, expenseDate }: { enteredByName: string; expenseDate: string }) {
  const { t } = useT();
  const [total, setTotal] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const expense = useExpenseForDate(expenseDate);
  const entries = useMealEntries(expenseDate);
  const charge = useChargeDay();
  const attach = useAttachReceipts();

  const members = useMembers();
  // Ticks the admin changed by hand; anything untouched falls back to
  // "ticked if they signed up for this day".
  const [ticks, setTicks] = useState<Record<string, boolean>>({});
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [search, setSearch] = useState("");

  // Every member, plus any sign-up from someone no longer in the member list.
  const signups = new Map((entries.data ?? []).filter((entry) => entry.UserId).map((entry) => [String(entry.UserId), entry]));
  const rows: Person[] = (members.data ?? [])
    .filter((member) => member.itemId)
    .map((member) => ({ entry: signups.get(member.itemId!), userEmail: member.email ?? "", userId: member.itemId!, userName: userDisplayName(member) }));
  for (const [userId, entry] of signups) {
    if (!rows.some((row) => row.userId === userId)) {
      rows.push({ entry, userEmail: String(entry.UserEmail ?? ""), userId, userName: String(entry.UserName ?? entry.UserEmail ?? "") });
    }
  }
  rows.sort((a, b) => Number(Boolean(b.entry)) - Number(Boolean(a.entry)) || a.userName.localeCompare(b.userName));

  const isTicked = (row: Person) => ticks[row.userId] ?? Boolean(row.entry);
  const includedRows = rows.filter(isTicked);
  const query = search.trim().toLowerCase();
  const visibleRows = rows.filter((row) => !query || `${row.userName} ${row.userEmail}`.toLowerCase().includes(query));
  const amount = Number(total);

  // Typed amounts are kept as entered; whatever is left of the total is
  // split evenly across everyone without a typed amount.
  const shares = new Map<string, number>();
  const fixed = includedRows.filter((row) => custom[row.userId] !== undefined && custom[row.userId] !== "");
  const auto = includedRows.filter((row) => !fixed.includes(row));
  const fixedSum = fixed.reduce((sum, row) => sum + Number(custom[row.userId]), 0);
  fixed.forEach((row) => shares.set(row.userId, roundMoney(Number(custom[row.userId]))));
  splitEvenly(Math.max(0, (amount || 0) - fixedSum), auto.length).forEach((share, index) => {
    const row = auto[index];
    if (row) shares.set(row.userId, share);
  });
  const amountFor = (userId: string) => shares.get(userId) ?? 0;
  const assignedSum = roundMoney(includedRows.reduce((sum, row) => sum + amountFor(row.userId), 0));

  function setTicked(targets: Person[], value: boolean) {
    setTicks((current) => ({ ...current, ...Object.fromEntries(targets.map((row) => [row.userId, value])) }));
  }

  function setCustomAmount(userId: string, value: string) {
    setCustom((current) => {
      const next = { ...current };
      if (value === "") delete next[userId];
      else next[userId] = value;
      return next;
    });
  }

  if (expense.isLoading || entries.isLoading) return <Skeleton className="skeleton-line" />;

  if (expense.data) {
    return (
      <div className="charge-summary">
        <div><span>{t("expenses.total")}</span><strong>{formatMoney(Number(expense.data.TotalAmount ?? 0))}</strong></div>
        <div><span>{t("expenses.people")}</span><strong>{expense.data.HeadCount ?? 0}</strong></div>
        <div><span>{t("expenses.average")}</span><strong>{formatMoney(Number(expense.data.PerHeadAmount ?? 0))}</strong></div>
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

  const balanceOff = amount > 0 && includedRows.length > 0 && Math.abs(assignedSum - roundMoney(amount)) > 0.005;

  return (
    <form
      className="form-grid"
      onSubmit={(event) => {
        event.preventDefault();
        charge.mutate(
          {
            enteredByName,
            expenseDate,
            files,
            note,
            people: includedRows.map((row) => ({ amount: amountFor(row.userId), entry: row.entry, userEmail: row.userEmail, userId: row.userId, userName: row.userName })),
            removed: rows.filter((row) => row.entry && !isTicked(row)).map((row) => row.entry!),
            totalAmount: amount
          },
          { onSuccess: () => { setTotal(""); setNote(""); setFiles([]); setTicks({}); setCustom({}); } }
        );
      }}
    >
      <FormField label={t("expenses.totalCost")} type="number" min="0" step="0.01" inputMode="decimal" required value={total} onChange={(event) => setTotal(event.target.value)} />
      <FormField label={t("expenses.note")} placeholder={t("expenses.notePlaceholder")} value={note} onChange={(event) => setNote(event.target.value)} />

      <div className="form-span people-picker">
        <div className="people-picker-header">
          <span className="receipt-label">{t("expenses.whoAte")} ({includedRows.length})</span>
          <div className="people-picker-actions">
            <button type="button" className="link-button" onClick={() => setTicked(visibleRows, true)}>{t("expenses.selectAll")}</button>
            <button type="button" className="link-button" onClick={() => setTicked(visibleRows, false)}>{t("expenses.clearAll")}</button>
            {Object.keys(custom).length > 0 ? <button type="button" className="link-button" onClick={() => setCustom({})}>{t("expenses.splitEqually")}</button> : null}
          </div>
        </div>
        <p className="muted">{t("expenses.whoAteHint")}</p>
        <label className="search-box"><Search size={16} /><input placeholder={t("members.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        {members.isLoading ? <Skeleton className="skeleton-line" /> : members.isError ? (
          <Alert tone="error">{members.error.message}</Alert>
        ) : visibleRows.length === 0 ? <p className="muted">{t("members.emptyTitle")}</p> : (
          <div className="people-list">
            {visibleRows.map((row) => {
              const included = isTicked(row);
              return (
                <div key={row.userId} className={`people-row${included ? "" : " people-row-off"}`}>
                  <label className="people-check">
                    <input type="checkbox" checked={included} onChange={() => setTicked([row], !included)} />
                    <span>
                      <strong>{row.userName || row.userEmail}</strong>
                      <small>{row.entry ? t("expenses.signedUp") : row.userEmail}</small>
                    </span>
                  </label>
                  <input
                    aria-label={`${t("members.amount")} ${row.userName}`}
                    className="people-amount"
                    disabled={!included}
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    type="number"
                    placeholder={included ? amountFor(row.userId).toFixed(2) : "—"}
                    value={included ? custom[row.userId] ?? "" : ""}
                    onChange={(event) => setCustomAmount(row.userId, event.target.value)}
                  />
                </div>
              );
            })}
          </div>
        )}
        {rows.some((row) => row.entry && !isTicked(row)) ? <p className="muted">{t("expenses.untickedNote")}</p> : null}
      </div>

      <div className="form-span"><ReceiptPicker disabled={charge.isPending} files={files} onChange={setFiles} /></div>
      <div className="form-actions">
        <span className={balanceOff ? "amount-negative" : "muted"}>
          {includedRows.length === 0
            ? t("expenses.noOneChosen")
            : `${includedRows.length} ${t("expenses.people").toLowerCase()} · ${formatMoney(assignedSum)} / ${formatMoney(amount || 0)}`}
        </span>
        <ActionButton type="submit" disabled={charge.isPending || includedRows.length === 0 || !(amount > 0) || balanceOff} icon={<Receipt size={18} />}>
          {charge.isPending ? t("common.loading") : t("expenses.charge")}
        </ActionButton>
      </div>
      {balanceOff ? <div className="form-span"><Alert tone="warn">{t("expenses.mismatch")}</Alert></div> : null}
      {charge.error ? <div className="form-span"><Alert tone="error">{charge.error.message}</Alert></div> : null}
    </form>
  );
}
