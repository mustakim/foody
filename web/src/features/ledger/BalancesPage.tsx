import { RefreshCw, Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney, roundMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useCurrentUser } from "../profile/useCurrentUser";
import { balancesByUser } from "./ledgerApi";
import type { UserBalance } from "./ledgerApi";
import { useLedger } from "./useLedger";

// Everyone's advance, meal cost and balance, built from the shared ledger so
// regular users can see it without the IAM user-list permission.
export function BalancesPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const myId = me.data?.data?.itemId;
  const ledger = useLedger();
  const [search, setSearch] = useState("");

  const all = useMemo(
    () => Array.from(balancesByUser(ledger.data ?? []).values()).sort((a, b) => a.userName.localeCompare(b.userName)),
    [ledger.data]
  );
  const query = search.trim().toLowerCase();
  const rows = all.filter((row) => !query || row.userName.toLowerCase().includes(query));
  const totalAdvance = roundMoney(all.reduce((sum, row) => sum + row.credited, 0));
  const totalMeals = roundMoney(all.reduce((sum, row) => sum + row.charged, 0));

  return (
    <section>
      <PageHeader
        title={t("balances.title")}
        subtitle={t("balances.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => ledger.refetch()} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="metrics">
        <div className="metric"><span>{t("balances.totalAdvance")}</span>{ledger.isLoading ? <Skeleton className="skeleton-line-lg" /> : <strong>{formatMoney(totalAdvance)}</strong>}</div>
        <div className="metric"><span>{t("balances.totalMeals")}</span>{ledger.isLoading ? <Skeleton className="skeleton-line-lg" /> : <strong>{formatMoney(totalMeals)}</strong>}</div>
        <div className="metric">
          <span>{t("balances.remaining")}</span>
          {ledger.isLoading ? <Skeleton className="skeleton-line-lg" /> : <strong className={totalAdvance - totalMeals < 0 ? "amount-negative" : ""}>{formatMoney(roundMoney(totalAdvance - totalMeals))}</strong>}
          <small>{t("balances.remainingHint")}</small>
        </div>
      </div>

      <div className="toolbar">
        <label className="search-box"><Search size={16} /><input placeholder={t("balances.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>

      <div className="panel">
        <div className="panel-title"><Scale size={16} /><span>{t("balances.title")} ({rows.length})</span></div>
        {ledger.isError ? (
          <ErrorState message={ledger.error.message} onRetry={() => ledger.refetch()} />
        ) : ledger.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Scale size={20} />} title={t("balance.emptyTitle")} description={t("balances.emptyDescription")} />
        ) : (
          <DataTable<UserBalance>
            rows={rows}
            columns={[
              { header: t("meals.colName"), key: "name", render: (row) => (row.userId === myId ? <strong>{row.userName} ({t("balances.you")})</strong> : row.userName || "—") },
              { header: t("balance.credited"), key: "advance", render: (row) => formatMoney(row.credited) },
              { header: t("balance.charged"), key: "meals", render: (row) => formatMoney(row.charged) },
              {
                header: t("members.balance"),
                key: "balance",
                render: (row) => <span className={row.balance < 0 ? "amount-negative" : "amount-positive"}>{formatMoney(row.balance)}</span>
              }
            ]}
          />
        )}
      </div>
    </section>
  );
}
