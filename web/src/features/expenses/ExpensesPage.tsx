import { CalendarDays, Receipt, RefreshCw } from "lucide-react";
import { useState } from "react";
import { formatMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { FormField } from "../../shared/ui/FormField";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { todayKey } from "../meals/mealsApi";
import { useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import { ChargeDayForm } from "./ChargeDayForm";
import { receiptsOf } from "./receiptsApi";
import { ReceiptLinks } from "./Receipts";
import type { DailyExpense } from "./expensesApi";
import { useExpenses } from "./useExpenses";

export function ExpensesPage() {
  const { t } = useT();
  const [date, setDate] = useState(todayKey());
  const me = useCurrentUser();
  const expenses = useExpenses();
  const list = expenses.data ?? [];
  const totalSpent = list.reduce((sum, expense) => sum + Number(expense.TotalAmount ?? 0), 0);

  return (
    <section>
      <PageHeader
        title={t("expenses.title")}
        subtitle={t("expenses.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => expenses.refetch()} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="panel">
        <div className="panel-title"><Receipt size={16} /><span>{t("expenses.enterTitle")}</span></div>
        <div className="form-grid">
          <FormField label={t("expenses.date")} type="date" max={todayKey()} value={date} onChange={(event) => event.target.value && setDate(event.target.value)} />
        </div>
        <ChargeDayForm key={date} expenseDate={date} enteredByName={userDisplayName(me.data?.data)} />
      </div>

      <div className="metrics">
        <div className="metric"><span>{t("expenses.daysCharged")}</span><strong>{list.length}</strong></div>
        <div className="metric"><span>{t("expenses.totalSpent")}</span><strong>{formatMoney(totalSpent)}</strong></div>
      </div>

      <div className="panel">
        <div className="panel-title"><CalendarDays size={16} /><span>{t("expenses.historyTitle")}</span></div>
        {expenses.isError ? (
          <ErrorState message={expenses.error.message} onRetry={() => expenses.refetch()} />
        ) : expenses.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : list.length === 0 ? (
          <EmptyState icon={<Receipt size={20} />} title={t("expenses.emptyTitle")} description={t("expenses.emptyDescription")} />
        ) : (
          <DataTable<DailyExpense>
            rows={list}
            columns={[
              { header: t("expenses.date"), key: "date", render: (row) => <button type="button" className="link-button" onClick={() => setDate(String(row.ExpenseDate ?? todayKey()))}>{row.ExpenseDate ?? ""}</button> },
              { header: t("expenses.total"), key: "total", render: (row) => formatMoney(Number(row.TotalAmount ?? 0)) },
              { header: t("expenses.people"), key: "people", render: (row) => row.HeadCount ?? 0 },
              { header: t("expenses.average"), key: "perHead", render: (row) => formatMoney(Number(row.PerHeadAmount ?? 0)) },
              { header: t("expenses.note"), key: "note", render: (row) => row.Note || "—" },
              { header: t("receipts.label"), key: "receipts", render: (row) => <ReceiptLinks receipts={receiptsOf(row)} /> },
              { header: t("expenses.enteredBy"), key: "by", render: (row) => row.EnteredByName || "—" }
            ]}
          />
        )}
      </div>
    </section>
  );
}
