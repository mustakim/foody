import { LogIn } from "lucide-react";
import { useState } from "react";
import snacksImage from "../../assets/snacks.jpg";
import { useAuth } from "../../app/providers/AuthProvider";
import { isLoginConfigured } from "../../lib/blocks/config";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { Alert } from "../../shared/ui/Alert";
import { FoodyLogo } from "../../shared/ui/FoodyLogo";

export function LoginPage({ returnTo }: { returnTo?: string }) {
  const { login } = useAuth();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const { t } = useT();
  const configured = isLoginConfigured();

  async function handleLogin() {
    setError(undefined);
    setPending(true);
    try {
      await login(returnTo);
    } catch (caught) {
      setError((caught as Error).message);
      setPending(false);
    }
  }

  return (
    <div className="welcome-screen">
      <div className="welcome-image" role="img" aria-label={t("auth.imageAlt")} style={{ backgroundImage: `url(${snacksImage})` }} />
      <div className="welcome-panel">
        <div className="welcome-brand">
          <FoodyLogo size={64} />
          <h1>{t("app.name")}</h1>
          <p>{t("auth.tagline")}</p>
        </div>
        {!configured ? (
          <Alert tone="warn">
            {t("auth.notConfigured")} <code>{window.location.origin}/login/callback</code>
          </Alert>
        ) : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        <button className="primary-button auth-submit" disabled={!configured || pending} onClick={handleLogin}>
          <LogIn size={18} /> {pending ? t("auth.redirecting") : t("auth.continue")}
        </button>
      </div>
    </div>
  );
}
