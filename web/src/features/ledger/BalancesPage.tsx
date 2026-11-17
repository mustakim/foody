import { RefreshCw, Scale, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney, roundMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { useExpenses } from "../expenses/useExpenses";
import { isAdmin, useCurrentUser } from "../profile/useCurrentUser";
import { balancesByUser } from "./ledgerApi";
import type { UserBalance } from "./ledgerApi";
import { PersonBreakdown } from "./PersonBreakdown";
import { useLedger } from "./useLedger";

// Everyone's advance, meal cost and balance, built from the shared ledger so
// regular users can see it without the IAM user-list permission.
// Admin adjustments (deductions, corrections) are shown as part of the
// advance, so each row still reads advance - meal cost = balance.
const netAdvance = (row: UserBalance) => roundMoney(row.credited + row.adjusted);

export function BalancesPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const myId = me.data?.data?.itemId;
  const ledger = useLedger();
  const expenses = useExpenses();
  const [search, setSearch] = useState("");
  const [openPerson, setOpenPerson] = useState<UserBalance | null>(null);

  const all = useMemo(
    () => Array.from(balancesByUser(ledger.data ?? []).values()).sort((a, b) => a.userName.localeCompare(b.userName)),
    [ledger.data]
  );
  const query = search.trim().toLowerCase();
  const rows = all.filter((row) => !query || row.userName.toLowerCase().includes(query));
  const totalAdvance = roundMoney(all.reduce((sum, row) => sum + netAdvance(row), 0));
  // Meal cost comes from the days' expenses themselves, so it matches the
  // Expenses page even if a person's charge is missing from the ledger.
  const totalMeals = roundMoney((expenses.data ?? []).reduce((sum, expense) => sum + Number(expense.TotalAmount ?? 0), 0));
  const remaining = roundMoney(totalAdvance - totalMeals);
  // Expenses not yet shared out to anyone: they lower the cash remaining but
  // nobody's balance, so the two only agree once this is zero.
  const totalCharged = roundMoney(all.reduce((sum, row) => sum + row.charged, 0));
  const unallocated = roundMoney(totalMeals - totalCharged);
  const toCollect = roundMoney(all.reduce((sum, row) => sum + Math.min(0, row.balance), 0) * -1);
  const owing = all.filter((row) => row.balance < 0).length;
  const loading = ledger.isLoading || expenses.isLoading;

  return (
    <section>
      <PageHeader
        title={t("balances.title")}
        subtitle={`${t("balances.subtitle")} ${t("balances.allTime")}`}
        actions={<ActionButton variant="icon" onClick={() => { ledger.refetch(); expenses.refetch(); }} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="metrics">
        <div className="metric"><span>{t("balances.totalAdvance")}</span>{loading ? <Skeleton className="skeleton-line-lg" /> : <strong>{formatMoney(totalAdvance)}</strong>}</div>
        <div className="metric">
          <span>{t("balances.totalMeals")}</span>
          {loading ? <Skeleton className="skeleton-line-lg" /> : <strong>{formatMoney(totalMeals)}</strong>}
          <small>{t("balances.totalMealsHint")}</small>
        </div>
        <div className="metric">
          <span>{t("balances.remaining")}</span>
          {loading ? <Skeleton className="skeleton-line-lg" /> : <strong className={remaining < 0 ? "amount-negative" : ""}>{formatMoney(remaining)}</strong>}
          <small>{t("balances.remainingHint")}</small>
        </div>
        <div className="metric">
          <span>{t("balances.toCollect")}</span>
          {loading ? <Skeleton className="skeleton-line-lg" /> : <strong className={toCollect > 0 ? "amount-negative" : ""}>{formatMoney(toCollect)}</strong>}
          <small>{t("balances.toCollectHint").replace("{count}", String(owing))}</small>
        </div>
      </div>

      {!loading && Math.abs(unallocated) > 0.005 ? (
        <Alert tone="warn">
          {t(isAdmin(me.data?.data) ? "balances.unallocatedAdmin" : "balances.unallocated").replace("{amount}", formatMoney(unallocated))}
        </Alert>
      ) : null}

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
              { header: t("balance.credited"), key: "advance", render: (row) => formatMoney(netAdvance(row)) },
              {
                header: t("balance.charged"),
                key: "meals",
                render: (row) => <button type="button" className="link-button" title={t("breakdown.open")} onClick={() => setOpenPerson(row)}>{formatMoney(row.charged)}</button>
              },
              {
                header: t("members.balance"),
                key: "balance",
                render: (row) => (row.balance < 0
                  ? <span className="amount-negative">{t("balances.due").replace("{amount}", formatMoney(-row.balance))}</span>
                  : <span className="amount-positive">{formatMoney(row.balance)}</span>)
              }
            ]}
          />
        )}
      </div>

      {openPerson ? <PersonBreakdown entries={ledger.data ?? []} person={openPerson} onClose={() => setOpenPerson(null)} /> : null}
    </section>
  );
}
