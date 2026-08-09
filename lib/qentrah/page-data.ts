export const QENTRAH_DATA_VERSION = 1 as const;

export type QentrahPageData = {
  builder: "qentrah";
  version: typeof QENTRAH_DATA_VERSION;
  serialized: string;
};

export function isQentrahPageData(value: unknown): value is QentrahPageData {
  if (!value || typeof value !== "object") return false;
  const data = value as Partial<QentrahPageData>;
  return (
    data.builder === "qentrah" &&
    data.version === QENTRAH_DATA_VERSION &&
    typeof data.serialized === "string"
  );
}

export function createQentrahPageData(serialized: string): QentrahPageData {
  return { builder: "qentrah", version: QENTRAH_DATA_VERSION, serialized };
}
