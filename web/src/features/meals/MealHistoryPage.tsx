import { CalendarDays, History, RefreshCw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { FormField } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { receiptsOf } from "../expenses/receiptsApi";
import { ReceiptLinks } from "../expenses/Receipts";
import { useExpenses } from "../expenses/useExpenses";
import { todayKey } from "./mealsApi";
import type { MealEntry } from "./mealsApi";
import { useMealHistory } from "./useMeals";

// Admin view: who ate on each day of a month, newest day first, with the
// day's expense alongside so the two can be checked against each other.
export function MealHistoryPage() {
  const { t } = useT();
  const [month, setMonth] = useState(todayKey().slice(0, 7));
  const [search, setSearch] = useState("");
  const history = useMealHistory(month);
  const expenses = useExpenses();

  const query = search.trim().toLowerCase();
  const days = useMemo(() => {
    const byDate = new Map<string, MealEntry[]>();
    for (const entry of history.data ?? []) {
      const name = `${entry.UserName ?? ""} ${entry.UserEmail ?? ""}`.toLowerCase();
      if (query && !name.includes(query)) continue;
      const date = String(entry.MealDate ?? "");
      byDate.set(date, [...(byDate.get(date) ?? []), entry]);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([date, entries]) => ({ date, entries: entries.sort((a, b) => String(a.UserName ?? "").localeCompare(String(b.UserName ?? ""))) }));
  }, [history.data, query]);
  const expenseByDate = new Map((expenses.data ?? []).map((expense) => [expense.ExpenseDate, expense]));
  const totalMeals = days.reduce((sum, day) => sum + day.entries.length, 0);

  return (
    <section>
      <PageHeader
        title={t("history.title")}
        subtitle={t("history.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => { history.refetch(); expenses.refetch(); }} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="filter-grid">
        <FormField label={t("history.month")} type="month" max={todayKey().slice(0, 7)} value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />
        <label className="form-field">
          <span>{t("history.person")}</span>
          <div className="search-box"><Search size={16} /><input placeholder={t("balances.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        </label>
      </div>

      <div className="metrics">
        <div className="metric"><span>{t("history.days")}</span><strong>{days.length}</strong></div>
        <div className="metric"><span>{t("history.meals")}</span><strong>{totalMeals}</strong><small>{t("history.mealsHint")}</small></div>
      </div>

      {history.isError ? (
        <ErrorState message={history.error.message} onRetry={() => history.refetch()} />
      ) : history.isLoading ? (
        <Skeleton className="skeleton-line" />
      ) : days.length === 0 ? (
        <EmptyState icon={<History size={20} />} title={t("history.emptyTitle")} description={t("history.emptyDescription")} />
      ) : (
        days.map(({ date, entries }) => {
          const expense = expenseByDate.get(date);
          return (
            <div key={date} className="panel">
              <div className="day-header">
                <div className="panel-title">
                  <CalendarDays size={16} />
                  <span>{new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", weekday: "long", year: "numeric" })}</span>
                </div>
                <span className="muted">{entries.length} {t("expenses.people").toLowerCase()}</span>
                {expense ? (
                  <StatusPill tone="good">{`${t("expenses.total")} ${formatMoney(Number(expense.TotalAmount ?? 0))}`}</StatusPill>
                ) : (
                  <StatusPill tone="warn">{t("history.notCharged")}</StatusPill>
                )}
              </div>
              <div className="chips">
                {entries.map((entry) => (
                  <span key={String(entry.ItemId ?? entry.UserId)} className="chip" title={entry.UserEmail}>
                    {entry.UserName || entry.UserEmail}{entry.IsCharged ? ` · ${formatMoney(Number(entry.ChargeAmount ?? 0))}` : ""}
                  </span>
                ))}
              </div>
              {expense && receiptsOf(expense).length > 0 ? <ReceiptLinks receipts={receiptsOf(expense)} /> : null}
            </div>
          );
        })
      )}
    </section>
  );
}
