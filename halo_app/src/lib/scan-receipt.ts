import TextRecognition from '@react-native-ml-kit/text-recognition';

/**
 * OCR a receipt image and return raw extracted text.
 * Throws on unsupported platforms (web fallback returns empty).
 */
export async function recognizeReceiptText(uri: string): Promise<string> {
  const result = await TextRecognition.recognize(uri);
  return result.text;
}

export const SCAN_RECEIPT_SUPPORTED = true;
