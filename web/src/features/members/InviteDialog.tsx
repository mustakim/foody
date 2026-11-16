import { useState } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { ActionButton } from "../../shared/ui/ActionButton";
import { Alert } from "../../shared/ui/Alert";
import { FormField } from "../../shared/ui/FormField";
import { Modal } from "../../shared/ui/Modal";
import { useInviteMember } from "./useMembers";

export function InviteDialog({ onClose, onInvited }: { onClose: () => void; onInvited: (email: string) => void }) {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const invite = useInviteMember();

  return (
    <Modal title={t("members.invite")} onClose={onClose}>
      <form
        className="dialog-form"
        onSubmit={(event) => {
          event.preventDefault();
          invite.mutate({ email, firstName, lastName }, { onSuccess: () => { onInvited(email.trim()); onClose(); } });
        }}
      >
        <FormField autoFocus label={t("meals.colEmail")} type="email" required placeholder="name@selisegroup.com" value={email} onChange={(event) => setEmail(event.target.value)} />
        <div className="form-grid">
          <FormField label={t("members.firstName")} required value={firstName} onChange={(event) => setFirstName(event.target.value)} />
          <FormField label={t("members.lastName")} value={lastName} onChange={(event) => setLastName(event.target.value)} />
        </div>
        <p className="muted">{t("members.inviteHint")}</p>
        {invite.error ? <Alert tone="error">{invite.error.message}</Alert> : null}
        <div className="modal-actions">
          <button type="button" className="icon-button" onClick={onClose}>{t("common.cancel")}</button>
          <ActionButton type="submit" disabled={invite.isPending}>{invite.isPending ? t("common.loading") : t("members.sendInvite")}</ActionButton>
        </div>
      </form>
    </Modal>
  );
}
