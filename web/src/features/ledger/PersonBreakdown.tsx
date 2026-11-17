import { formatMoney, roundMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { DataTable } from "../../shared/ui/DataTable";
import { Modal } from "../../shared/ui/Modal";
import { StatusPill } from "../../shared/ui/StatusPill";
import { signedAmount } from "./ledgerMath";
import type { LedgerEntry, UserBalance } from "./ledgerMath";

// Everything behind one person's numbers on Everyone's balance: snacks cost
// per month (balances are all-time, snacks history is one month at a time)
// and every entry, newest first.
export function PersonBreakdown({ entries, person, onClose }: { entries: LedgerEntry[]; person: UserBalance; onClose: () => void }) {
  const { t } = useT();
  const mine = entries.filter((entry) => entry.UserId === person.userId);
  const months = new Map<string, { cost: number; days: number }>();
  for (const entry of mine) {
    if (entry.EntryType !== "charge") continue;
    const month = String(entry.EntryDate ?? "").slice(0, 7);
    const current = months.get(month) ?? { cost: 0, days: 0 };
    months.set(month, { cost: roundMoney(current.cost + Number(entry.Amount ?? 0)), days: current.days + 1 });
  }
  const monthRows = [...months].sort(([a], [b]) => b.localeCompare(a)).map(([month, value]) => ({ month, ...value }));
  const monthLabel = (month: string) => new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <Modal title={person.userName} onClose={onClose}>
      <div className="breakdown">
        <div className="charge-summary">
          <div><span>{t("balance.credited")}</span><strong>{formatMoney(roundMoney(person.credited + person.adjusted))}</strong></div>
          <div><span>{t("balance.charged")}</span><strong>{formatMoney(person.charged)}</strong></div>
          <div><span>{t("members.balance")}</span><strong className={person.balance < 0 ? "amount-negative" : "amount-positive"}>{formatMoney(person.balance)}</strong></div>
        </div>

        <span className="receipt-label">{t("breakdown.byMonth")}</span>
        <DataTable<{ month: string; cost: number; days: number }>
          rows={monthRows}
          columns={[
            { header: t("history.month"), key: "month", render: (row) => monthLabel(row.month) },
            { header: t("history.days"), key: "days", render: (row) => row.days },
            { header: t("balance.charged"), key: "cost", render: (row) => formatMoney(row.cost) }
          ]}
        />

        <span className="receipt-label">{t("balance.historyTitle")}</span>
        <DataTable<LedgerEntry>
          rows={mine}
          columns={[
            { header: t("expenses.date"), key: "date", render: (row) => row.EntryDate ?? "" },
            {
              header: t("balance.type"),
              key: "type",
              render: (row) => (
                <StatusPill tone={row.EntryType === "charge" ? "warn" : row.EntryType === "adjustment" ? "neutral" : "good"}>
                  {row.EntryType === "charge" ? t("balance.mealCharge") : row.EntryType === "adjustment" ? t("balance.adjustment") : t("balance.credit")}
                </StatusPill>
              )
            },
            {
              header: t("members.amount"),
              key: "amount",
              render: (row) => <span className={signedAmount(row) < 0 ? "amount-negative" : "amount-positive"}>{signedAmount(row) > 0 ? "+" : ""}{formatMoney(signedAmount(row))}</span>
            }
          ]}
        />
      </div>
    </Modal>
  );
}
