import { blocksClient } from "../../lib/blocks/client";

const STORAGE_CONFIGURATION = "Default";
export const RECEIPT_ACCEPT = "image/*,application/pdf";
const MAX_RECEIPT_BYTES = 10 * 1024 * 1024;

export type Receipt = { fileId: string; name: string };

// Cloud (Azure) upload: ask Blocks for a pre-signed URL, which also creates
// the file record, then PUT the bytes straight to storage.
export async function uploadReceipt(file: File, expenseDate: string): Promise<Receipt> {
  if (file.size > MAX_RECEIPT_BYTES) throw new Error(`${file.name} is larger than 10 MB.`);
  // Names must be unique within a directory, so stamp each upload.
  const safeName = file.name.replace(/[^\w.-]+/g, "_");
  const presign = (await blocksClient.data.files.presignedUploadUrl({
    accessModifier: "Private",
    configurationName: STORAGE_CONFIGURATION,
    contentType: file.type || "application/octet-stream",
    name: `expense-${expenseDate}-${Date.now()}-${safeName}`,
    tags: `expense-receipt,${expenseDate}`
  })) as { uploadUrl?: string; fileId?: string; isSuccess?: boolean; errors?: Record<string, string>; requiredHeaders?: Record<string, string> } | null;

  if (!presign?.isSuccess || !presign.uploadUrl || !presign.fileId) {
    throw new Error(`Could not start upload of ${file.name}: ${JSON.stringify(presign?.errors ?? {})}`);
  }
  try {
    await blocksClient.data.files.uploadToUrl({
      body: file,
      contentType: file.type || "application/octet-stream",
      headers: presign.requiredHeaders,
      url: presign.uploadUrl
    });
  } catch (error) {
    // The file record exists but has no bytes; remove it so it can't be opened empty.
    await blocksClient.data.files.delete({ fileId: presign.fileId, permanent: true }).catch(() => undefined);
    throw new Error(`Upload of ${file.name} failed: ${(error as Error).message}`);
  }
  return { fileId: presign.fileId, name: file.name };
}

export async function receiptDownloadUrl(fileId: string): Promise<string> {
  const response = await blocksClient.data.files.get(fileId, { configurationName: STORAGE_CONFIGURATION });
  const url = findUrl(response);
  if (!url) throw new Error("This document has no download link.");
  return url;
}

// The file response shape isn't typed by the SDK; take the first URL-valued field.
function findUrl(value: unknown): string | undefined {
  if (!value || typeof value !== "object") return undefined;
  for (const [key, field] of Object.entries(value as Record<string, unknown>)) {
    if (typeof field === "string" && /url/i.test(key) && /^https?:\/\//.test(field)) return field;
  }
  for (const field of Object.values(value as Record<string, unknown>)) {
    const nested = findUrl(field);
    if (nested) return nested;
  }
  return undefined;
}

export function receiptsOf(expense: { ReceiptFileIds?: string[]; ReceiptFileNames?: string[] }): Receipt[] {
  const ids = expense.ReceiptFileIds ?? [];
  return ids.map((fileId, index) => ({ fileId, name: expense.ReceiptFileNames?.[index] || `Document ${index + 1}` }));
}
