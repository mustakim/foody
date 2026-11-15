import { FileText, ImagePlus, Paperclip, X } from "lucide-react";
import { useRef, useState } from "react";
import { useT } from "../../lib/i18n/LocalizationProvider";
import { RECEIPT_ACCEPT, receiptDownloadUrl } from "./receiptsApi";
import type { Receipt } from "./receiptsApi";

// File chooser for bill photos / PDFs. On phones, image/* also offers the camera.
export function ReceiptPicker({ disabled, files, onChange }: { disabled?: boolean; files: File[]; onChange: (files: File[]) => void }) {
  const { t } = useT();
  const input = useRef<HTMLInputElement>(null);

  return (
    <div className="receipt-picker">
      <span className="receipt-label">{t("receipts.label")}</span>
      <div className="receipt-list">
        {files.map((file, index) => (
          <span key={`${file.name}-${index}`} className="chip receipt-chip">
            <FileText size={14} />{file.name}
            <button type="button" aria-label={`Remove ${file.name}`} onClick={() => onChange(files.filter((_, i) => i !== index))}><X size={14} /></button>
          </span>
        ))}
        <button type="button" className="icon-button" disabled={disabled} onClick={() => input.current?.click()}>
          <ImagePlus size={16} />{t("receipts.add")}
        </button>
      </div>
      <input
        ref={input}
        hidden
        multiple
        type="file"
        accept={RECEIPT_ACCEPT}
        onChange={(event) => {
          onChange([...files, ...Array.from(event.target.files ?? [])]);
          event.target.value = "";
        }}
      />
    </div>
  );
}

// Download links are short-lived, so fetch one only when the document is opened.
export function ReceiptLinks({ receipts }: { receipts: Receipt[] }) {
  const { t } = useT();
  const [error, setError] = useState("");
  if (receipts.length === 0) return <span className="muted">{t("receipts.none")}</span>;

  async function open(receipt: Receipt) {
    setError("");
    // Open the tab synchronously so pop-up blockers allow it, then point it at the file.
    const tab = window.open("", "_blank");
    try {
      const url = await receiptDownloadUrl(receipt.fileId);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (failure) {
      tab?.close();
      setError((failure as Error).message);
    }
  }

  return (
    <div className="receipt-list">
      {receipts.map((receipt) => (
        <button key={receipt.fileId} type="button" className="chip receipt-chip receipt-link" title={receipt.name} onClick={() => open(receipt)}>
          <Paperclip size={14} />{receipt.name}
        </button>
      ))}
      {error ? <span className="amount-negative">{error}</span> : null}
    </div>
  );
}
