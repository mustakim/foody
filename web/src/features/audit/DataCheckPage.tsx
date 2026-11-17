import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CheckCircle2, RefreshCw, TriangleAlert, Users } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { listExpenses } from "../expenses/expensesApi";
import { listLedger } from "../ledger/ledgerApi";
import { listAllMealEntries } from "../meals/mealsApi";
import { reconcile } from "./reconcile";
import type { DayCheck, PersonCheck } from "./reconcile";

// Admin-only: reads every expense, ledger entry and meal record and checks
// that they agree, day by day and person by person.
export function DataCheckPage() {
  const { t } = useT();
  const [onlyProblems, setOnlyProblems] = useState(true);
  const check = useQuery({
    queryFn: async () => {
      const [expenses, ledger, meals] = await Promise.all([listExpenses(), listLedger(), listAllMealEntries()]);
      return { counts: { expenses: expenses.length, ledger: ledger.length, meals: meals.length }, result: reconcile(expenses, ledger, meals) };
    },
    queryKey: ["audit"]
  });
  const result = check.data?.result;
  const counts = check.data?.counts ?? { expenses: 0, ledger: 0, meals: 0 };
  const problemDays = result?.days.filter((day) => day.issues.length > 0) ?? [];
  const problemPeople = result?.people.filter((row) => row.issues.length > 0) ?? [];
  const problemCount = problemDays.length + problemPeople.length + (result?.issues.length ?? 0);

  return (
    <section>
      <PageHeader
        title={t("audit.title")}
        subtitle={t("audit.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => check.refetch()} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />
      {check.isError ? <ErrorState message={check.error.message} onRetry={() => check.refetch()} /> : !result || check.isFetching ? <Skeleton className="skeleton-line" /> : (
        <>
          {problemCount === 0
            ? <Alert tone="info">{t("audit.allGood")}</Alert>
            : <Alert tone="warn">{t("audit.problems").replace("{count}", String(problemCount))}</Alert>}
          {result.issues.map((issue) => <Alert key={issue} tone="warn">{issue}</Alert>)}

          <div className="metrics">
            <div className="metric"><span>{t("audit.expenses")}</span><strong>{formatMoney(result.totals.expenses)}</strong><small>{counts.expenses} {t("audit.records")}</small></div>
            <div className="metric"><span>{t("audit.charges")}</span><strong>{formatMoney(result.totals.charges)}</strong><small>{t("audit.chargesHint")}</small></div>
            <div className="metric"><span>{t("audit.mealHistory")}</span><strong>{formatMoney(result.totals.mealCharged)}</strong><small>{counts.meals} {t("audit.records")}</small></div>
            <div className="metric">
              <span>{t("audit.unallocated")}</span>
              <strong className={result.totals.unallocated ? "amount-negative" : ""}>{formatMoney(result.totals.unallocated)}</strong>
              <small>{t("audit.unallocatedHint")}</small>
            </div>
          </div>
          <div className="metrics">
            <div className="metric"><span>{t("audit.advance")}</span><strong>{formatMoney(result.totals.advanceNet)}</strong><small>{counts.ledger} {t("audit.ledgerRecords")}</small></div>
            <div className="metric"><span>{t("audit.cash")}</span><strong>{formatMoney(result.totals.cashRemaining)}</strong><small>{t("audit.cashHint")}</small></div>
            <div className="metric"><span>{t("audit.balances")}</span><strong>{formatMoney(result.totals.balances)}</strong><small>{t("audit.balancesHint")}</small></div>
            <div className="metric"><span>{t("balances.toCollect")}</span><strong className="amount-negative">{formatMoney(result.totals.due)}</strong><small>{t("balances.toCollectHint").replace("{count}", String(result.totals.dueCount))}</small></div>
          </div>

          <div className="toolbar">
            <label className="people-check"><input type="checkbox" checked={onlyProblems} onChange={() => setOnlyProblems(!onlyProblems)} /><span>{t("audit.onlyProblems")}</span></label>
          </div>

          <div className="panel">
            <div className="panel-title"><CalendarDays size={16} /><span>{t("audit.days")} ({(onlyProblems ? problemDays : result.days).length})</span></div>
            <DataTable<DayCheck>
              rows={onlyProblems ? problemDays : result.days}
              columns={[
                { header: t("expenses.date"), key: "date", render: (row) => <a href={`/expenses?date=${row.date}`}>{row.date}</a> },
                { header: t("audit.expense"), key: "expense", render: (row) => (row.expenseCount ? `${formatMoney(row.expenseTotal)} · ${row.headCount}` : "—") },
                { header: t("audit.chargedCol"), key: "charged", render: (row) => `${formatMoney(row.charged)} · ${row.chargeCount}` },
                { header: t("audit.historyCol"), key: "history", render: (row) => `${formatMoney(row.mealCharged)} · ${row.mealCount}` },
                { header: t("audit.status"), key: "status", render: (row) => <Status issues={row.issues} /> }
              ]}
            />
          </div>

          <div className="panel">
            <div className="panel-title"><Users size={16} /><span>{t("audit.people")} ({(onlyProblems ? problemPeople : result.people).length})</span></div>
            <DataTable<PersonCheck>
              rows={onlyProblems ? problemPeople : result.people}
              columns={[
                { header: t("meals.colName"), key: "name", render: (row) => row.userName || row.userId },
                { header: t("balance.credited"), key: "advance", render: (row) => formatMoney(row.credited + row.adjusted) },
                { header: t("audit.chargedCol"), key: "charged", render: (row) => formatMoney(row.charged) },
                { header: t("audit.historyCol"), key: "history", render: (row) => formatMoney(row.mealCost) },
                { header: t("members.balance"), key: "balance", render: (row) => <span className={row.balance < 0 ? "amount-negative" : "amount-positive"}>{formatMoney(row.balance)}</span> },
                { header: t("audit.status"), key: "status", render: (row) => <Status issues={row.issues} /> }
              ]}
            />
          </div>
        </>
      )}
    </section>
  );
}

function Status({ issues }: { issues: string[] }) {
  const { t } = useT();
  if (issues.length === 0) return <span className="audit-ok"><CheckCircle2 size={16} /> {t("audit.ok")}</span>;
  return (
    <div className="audit-issues">
      <StatusPill tone="warn">{t("audit.problem")}</StatusPill>
      {issues.map((issue) => <small key={issue}><TriangleAlert size={12} /> {issue}</small>)}
    </div>
  );
}

