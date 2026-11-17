import { useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { RedirectIfAuthenticated, RequireAuth } from "./guards";
import { CallbackPage } from "../../features/auth/CallbackPage";
import { ErrorPage } from "../../features/auth/ErrorPage";
import { LoginPage } from "../../features/auth/LoginPage";
import { NotFoundPage } from "../../features/auth/NotFoundPage";
import { DataCheckPage } from "../../features/audit/DataCheckPage";
import { ExpensesPage } from "../../features/expenses/ExpensesPage";
import { BalancePage } from "../../features/ledger/BalancePage";
import { BalancesPage } from "../../features/ledger/BalancesPage";
import { MealHistoryPage } from "../../features/meals/MealHistoryPage";
import { TodayPage } from "../../features/meals/TodayPage";
import { MembersPage } from "../../features/members/MembersPage";
import { ProfilePage } from "../../features/profile/ProfilePage";
import { RequireAdmin } from "./RequireAdmin";

const protectedRoutes = {
  "/": TodayPage,
  "/balance": BalancePage,
  "/balances": BalancesPage,
  "/expenses": ExpensesPage,
  "/history": MealHistoryPage,
  "/members": MembersPage,
  "/check": DataCheckPage,
  "/profile": ProfilePage,
  "/error": ErrorPage
};

const adminRoutes = new Set(["/expenses", "/history", "/members", "/check"]);

export function AppRouter() {
  const [path, setPath] = useState(() => window.location.pathname);
  const [search, setSearch] = useState(() => window.location.search);

  useEffect(() => {
    const onPopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(nextPath: string) {
    const [nextPathname = "/", queryString = ""] = nextPath.split("?");
    window.history.pushState({}, "", nextPath);
    setPath(nextPathname);
    setSearch(queryString ? `?${queryString}` : "");
  }

  if (path === "/login/callback") {
    return <CallbackPage onNavigate={navigate} />;
  }

  if (path === "/login") {
    const returnTo = new URLSearchParams(search).get("returnTo") || undefined;
    return (
      <RedirectIfAuthenticated onNavigate={navigate}>
        <LoginPage returnTo={returnTo} />
      </RedirectIfAuthenticated>
    );
  }

  const Page = protectedRoutes[path as keyof typeof protectedRoutes];
  if (!Page) {
    return <NotFoundPage onNavigate={navigate} />;
  }

  return (
    <RequireAuth currentPath={path} onNavigate={navigate}>
      <AppShell activePath={path} onNavigate={navigate}>
        {adminRoutes.has(path) ? <RequireAdmin><Page /></RequireAdmin> : <Page />}
      </AppShell>
    </RequireAuth>
  );
}
