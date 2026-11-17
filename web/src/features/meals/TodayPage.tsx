import { CheckCircle2, Receipt, RefreshCw, UtensilsCrossed, Users, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { formatMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { ChargeDayForm } from "../expenses/ChargeDayForm";
import { useExpenseForDate } from "../expenses/useExpenses";
import { balanceOf } from "../ledger/ledgerApi";
import { useLedger } from "../ledger/useLedger";
import { isAdmin, useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import { CANCEL_CUTOFF_LABEL, canCancel, todayKey } from "./mealRules";
import type { MealEntry } from "./mealsApi";
import { useMealEntries, useMealMutations } from "./useMeals";

export function TodayPage() {
  const { t } = useT();
  const mealDate = todayKey();
  const me = useCurrentUser();
  const profile = me.data?.data;
  const entries = useMealEntries(mealDate);
  const { join, leave } = useMealMutations(mealDate);
  const todaysExpense = useExpenseForDate(mealDate);
  const myLedger = useLedger(profile?.itemId, Boolean(profile?.itemId));

  const list = entries.data ?? [];
  const myEntry = profile?.itemId ? list.find((entry) => entry.UserId === profile.itemId) : undefined;
  const admin = isAdmin(profile);
  const busy = join.isPending || leave.isPending;
  const mutationError = join.error ?? leave.error;
  const myBalance = balanceOf(myLedger.data ?? []);
  // Once today's cost has been split, late sign-ups would go uncharged.
  const dayClosed = Boolean(todaysExpense.data);
  // Re-check the 4 PM cancel cutoff every 30s so an open page locks on time.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  const cancelClosed = !canCancel(mealDate, now);
  const dateLabel = new Date().toLocaleDateString(undefined, { day: "numeric", month: "long", weekday: "long" });

  return (
    <section>
      <PageHeader
        title={t("meals.title")}
        subtitle={dateLabel}
        actions={<ActionButton variant="icon" onClick={() => entries.refetch()} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="metrics">
        <div className="metric">
          <span>{t("meals.headcount")}</span>
          {entries.isLoading ? <Skeleton className="skeleton-line-lg" /> : <strong>{list.length}</strong>}
          <small>{admin ? t("meals.headcountAdminHint") : t("meals.headcountHint")}</small>
        </div>
        <div className="metric">
          <span>{t("meals.yourStatus")}</span>
          {me.isLoading || entries.isLoading ? (
            <Skeleton className="skeleton-line" />
          ) : (
            <StatusPill tone={myEntry ? "good" : "neutral"}>{myEntry ? t("meals.youreIn") : t("meals.notSignedUp")}</StatusPill>
          )}
        </div>
        <div className="metric">
          <span>{t("balance.current")}</span>
          {myLedger.isLoading ? <Skeleton className="skeleton-line-lg" /> : <strong className={myBalance < 0 ? "amount-negative" : ""}>{formatMoney(myBalance)}</strong>}
          <small>{myBalance < 0 ? t("balance.owe") : t("balance.ok")}</small>
        </div>
      </div>

      <div className="panel">
        <div className="panel-title"><UtensilsCrossed size={16} /><span>{t("meals.joinTitle")}</span></div>
        {myEntry ? (
          <div className="row-actions">
            <ActionButton
              className="primary-button danger"
              disabled={busy || myEntry.IsCharged === true || cancelClosed}
              icon={<XCircle size={18} />}
              onClick={() => leave.mutate(myEntry)}
            >
              {leave.isPending ? t("common.loading") : t("meals.leave")}
            </ActionButton>
            {myEntry.IsCharged ? (
              <span className="muted">{t("meals.alreadyCharged")}</span>
            ) : cancelClosed ? (
              <span className="muted">{t("meals.cancelClosed").replace("{time}", CANCEL_CUTOFF_LABEL)}</span>
            ) : (
              <span className="muted">{t("meals.cancelUntil").replace("{time}", CANCEL_CUTOFF_LABEL)}</span>
            )}
          </div>
        ) : (
          <div className="row-actions">
            {dayClosed ? <span className="muted">{t("meals.dayClosed")}</span> : null}
            <ActionButton
              disabled={busy || !profile || entries.isLoading || dayClosed}
              icon={<CheckCircle2 size={18} />}
              onClick={() => profile && join.mutate(profile)}
            >
              {join.isPending ? t("common.loading") : t("meals.join")}
            </ActionButton>
          </div>
        )}
        {mutationError ? <Alert tone="error">{mutationError.message}</Alert> : null}
      </div>

      {admin ? (
        <div className="panel">
          <div className="panel-title"><Receipt size={16} /><span>{t("expenses.todayTitle")}</span></div>
          <ChargeDayForm expenseDate={mealDate} enteredByName={userDisplayName(profile)} />
        </div>
      ) : null}

      <div className="panel">
        <div className="panel-title"><Users size={16} /><span>{t("meals.listTitle")} ({list.length})</span></div>
        {entries.isError ? (
          <ErrorState message={entries.error.message} onRetry={() => entries.refetch()} />
        ) : entries.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : list.length === 0 ? (
          <EmptyState icon={<UtensilsCrossed size={20} />} title={t("meals.emptyTitle")} description={t("meals.emptyDescription")} />
        ) : (
          <DataTable<MealEntry>
            rows={list}
            columns={[
              { header: "#", key: "index", render: (row) => list.indexOf(row) + 1 },
              { header: t("meals.colName"), key: "name", render: (row) => row.UserName || row.UserEmail || "Unknown" },
              ...(admin ? [{ header: t("meals.colEmail"), key: "email", render: (row: MealEntry) => row.UserEmail || "" }] : []),
              ...(admin ? [{ header: t("expenses.perHead"), key: "amount", render: (row: MealEntry) => (row.IsCharged ? formatMoney(Number(row.ChargeAmount ?? 0)) : "—") }] : []),
              {
                header: t("meals.colStatus"),
                key: "status",
                render: (row) => <StatusPill tone={row.IsCharged ? "good" : "neutral"}>{row.IsCharged ? t("meals.charged") : t("meals.pending")}</StatusPill>
              }
            ]}
          />
        )}
      </div>
    </section>
  );
}
