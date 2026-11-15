import { RefreshCw, Wallet } from "lucide-react";
import { formatMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { useCurrentUser } from "../profile/useCurrentUser";
import { balancesByUser, signedAmount } from "./ledgerApi";
import type { LedgerEntry } from "./ledgerApi";
import { useLedger } from "./useLedger";

export function BalancePage() {
  const { t } = useT();
  const me = useCurrentUser();
  const userId = me.data?.data?.itemId;
  const ledger = useLedger(userId, Boolean(userId));
  const entries = ledger.data ?? [];
  const totals = (userId && balancesByUser(entries).get(userId)) || { balance: 0, charged: 0, credited: 0 };
  const loading = me.isLoading || ledger.isLoading;

  return (
    <section>
      <PageHeader
        title={t("balance.title")}
        subtitle={t("balance.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => ledger.refetch()} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="metrics">
        <div className="metric">
          <span>{t("balance.current")}</span>
          {loading ? <Skeleton className="skeleton-line-lg" /> : <strong className={totals.balance < 0 ? "amount-negative" : ""}>{formatMoney(totals.balance)}</strong>}
          <small>{totals.balance < 0 ? t("balance.owe") : t("balance.ok")}</small>
        </div>
        <div className="metric"><span>{t("balance.credited")}</span>{loading ? <Skeleton className="skeleton-line-lg" /> : <strong>{formatMoney(totals.credited)}</strong>}</div>
        <div className="metric"><span>{t("balance.charged")}</span>{loading ? <Skeleton className="skeleton-line-lg" /> : <strong>{formatMoney(totals.charged)}</strong>}</div>
      </div>

      <div className="panel">
        <div className="panel-title"><Wallet size={16} /><span>{t("balance.historyTitle")}</span></div>
        {ledger.isError ? (
          <ErrorState message={ledger.error.message} onRetry={() => ledger.refetch()} />
        ) : loading ? (
          <Skeleton className="skeleton-line" />
        ) : entries.length === 0 ? (
          <EmptyState icon={<Wallet size={20} />} title={t("balance.emptyTitle")} description={t("balance.emptyDescription")} />
        ) : (
          <DataTable<LedgerEntry>
            rows={entries}
            columns={[
              { header: t("expenses.date"), key: "date", render: (row) => row.EntryDate ?? "" },
              {
                header: t("balance.type"),
                key: "type",
                render: (row) => <StatusPill tone={row.EntryType === "charge" ? "warn" : "good"}>{row.EntryType === "charge" ? t("balance.mealCharge") : t("balance.credit")}</StatusPill>
              },
              { header: t("expenses.note"), key: "note", render: (row) => row.Note || "—" },
              {
                header: t("members.amount"),
                key: "amount",
                render: (row) => <span className={signedAmount(row) < 0 ? "amount-negative" : "amount-positive"}>{signedAmount(row) > 0 ? "+" : ""}{formatMoney(signedAmount(row))}</span>
              },
              { header: t("expenses.enteredBy"), key: "by", render: (row) => row.EnteredByName || "—" }
            ]}
          />
        )}
      </div>
    </section>
  );
}
