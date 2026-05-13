/**
 * Web does not have ML Kit. Return empty so callers can still call this fn
 * without crashing; UI should hide the Scan button when not supported.
 */
export async function recognizeReceiptText(_uri: string): Promise<string> {
  return '';
}

export const SCAN_RECEIPT_SUPPORTED = false;
