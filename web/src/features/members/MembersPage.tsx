import type { BlocksUser } from "@seliseblocks/client";
import { PlusCircle, RefreshCw, Search, ShieldPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { formatMoney } from "../../lib/blocks/items";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { DataTable } from "../../shared/ui/DataTable";
import { EmptyState } from "../../shared/ui/EmptyState";
import { ErrorState } from "../../shared/ui/ErrorState";
import { Modal } from "../../shared/ui/Modal";
import { PageHeader } from "../../shared/ui/PageHeader";
import { Skeleton } from "../../shared/ui/Skeleton";
import { StatusPill } from "../../shared/ui/StatusPill";
import { balancesByUser } from "../ledger/ledgerApi";
import { CreditDialog } from "../ledger/CreditDialog";
import { useLedger } from "../ledger/useLedger";
import { isAdmin, useCurrentUser, userDisplayName } from "../profile/useCurrentUser";
import { useMembers, usePromoteToAdmin } from "./useMembers";

export function MembersPage() {
  const { t } = useT();
  const me = useCurrentUser();
  const members = useMembers();
  const ledger = useLedger();
  const promote = usePromoteToAdmin();
  const [search, setSearch] = useState("");
  const [creditFor, setCreditFor] = useState<BlocksUser | null>(null);
  const [promoteFor, setPromoteFor] = useState<BlocksUser | null>(null);

  const balances = useMemo(() => balancesByUser(ledger.data ?? []), [ledger.data]);
  const balanceOf = (member: BlocksUser) => balances.get(member.itemId ?? "")?.balance ?? 0;
  const query = search.trim().toLowerCase();
  const rows = (members.data ?? []).filter((member) => !query || `${userDisplayName(member)} ${member.email ?? ""}`.toLowerCase().includes(query));
  const totalBalance = (members.data ?? []).reduce((sum, member) => sum + balanceOf(member), 0);
  const adminName = userDisplayName(me.data?.data);

  return (
    <section>
      <PageHeader
        title={t("members.title")}
        subtitle={t("members.subtitle")}
        actions={<ActionButton variant="icon" onClick={() => { members.refetch(); ledger.refetch(); }} title={t("common.refresh")} icon={<RefreshCw size={18} />} />}
      />

      <div className="metrics">
        <div className="metric"><span>{t("members.count")}</span><strong>{members.data?.length ?? "—"}</strong></div>
        <div className="metric"><span>{t("members.totalBalance")}</span><strong>{formatMoney(totalBalance)}</strong><small>{t("members.totalBalanceHint")}</small></div>
      </div>

      <div className="toolbar">
        <label className="search-box"><Search size={16} /><input placeholder={t("members.search")} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
      </div>
      {promote.error ? <Alert tone="error">{promote.error.message}</Alert> : null}

      <div className="panel">
        <div className="panel-title"><Users size={16} /><span>{t("members.title")} ({rows.length})</span></div>
        {members.isError ? (
          <ErrorState message={members.error.message} onRetry={() => members.refetch()} />
        ) : members.isLoading || ledger.isLoading ? (
          <Skeleton className="skeleton-line" />
        ) : rows.length === 0 ? (
          <EmptyState icon={<Users size={20} />} title={t("members.emptyTitle")} description={t("members.emptyDescription")} />
        ) : (
          <DataTable<BlocksUser>
            rows={rows}
            columns={[
              { header: t("meals.colName"), key: "name", render: (row) => userDisplayName(row) || "—" },
              { header: t("meals.colEmail"), key: "email", render: (row) => row.email ?? "" },
              { header: t("members.role"), key: "role", render: (row) => <StatusPill tone={isAdmin(row) ? "good" : "neutral"}>{isAdmin(row) ? "Admin" : "User"}</StatusPill> },
              {
                header: t("members.balance"),
                key: "balance",
                render: (row) => <span className={balanceOf(row) < 0 ? "amount-negative" : "amount"}>{formatMoney(balanceOf(row))}</span>
              },
              {
                header: "",
                key: "actions",
                render: (row) => (
                  <div className="row-actions">
                    <ActionButton icon={<PlusCircle size={16} />} onClick={() => setCreditFor(row)}>{t("members.addCredit")}</ActionButton>
                    {isAdmin(row) ? null : (
                      <ActionButton variant="icon" title={t("members.makeAdmin")} icon={<ShieldPlus size={16} />} disabled={promote.isPending} onClick={() => setPromoteFor(row)}>
                        {t("members.makeAdmin")}
                      </ActionButton>
                    )}
                  </div>
                )
              }
            ]}
          />
        )}
      </div>

      {creditFor?.itemId ? (
        <CreditDialog
          enteredByName={adminName}
          member={{ userId: creditFor.itemId, userName: userDisplayName(creditFor) }}
          onClose={() => setCreditFor(null)}
        />
      ) : null}

      {promoteFor ? (
        <Modal title={t("members.makeAdmin")} onClose={() => setPromoteFor(null)}>
          <p>{t("members.makeAdminConfirm").replace("{name}", userDisplayName(promoteFor))}</p>
          <div className="modal-actions">
            <button className="icon-button" onClick={() => setPromoteFor(null)}>{t("common.cancel")}</button>
            <ActionButton onClick={() => promote.mutate(promoteFor, { onSettled: () => setPromoteFor(null) })} disabled={promote.isPending}>
              {promote.isPending ? t("common.loading") : t("members.makeAdmin")}
            </ActionButton>
          </div>
        </Modal>
      ) : null}
    </section>
  );
}
