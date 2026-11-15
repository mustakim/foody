import { ShieldAlert } from "lucide-react";
import type { ReactNode } from "react";
import { isAdmin, useCurrentUser } from "../../features/profile/useCurrentUser";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { EmptyState } from "../../shared/ui/EmptyState";
import { Skeleton } from "../../shared/ui/Skeleton";

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { t } = useT();
  const me = useCurrentUser();
  if (me.isLoading) return <Skeleton className="skeleton-line" />;
  if (!isAdmin(me.data?.data)) return <EmptyState icon={<ShieldAlert size={20} />} title={t("admin.onlyTitle")} description={t("admin.onlyDescription")} />;
  return <>{children}</>;
}
