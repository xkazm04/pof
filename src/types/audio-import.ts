export interface AudioImportResult {
  id: number;
  setName: string;
  eventKey: string | null;
  surface: string | null;
  assetsImported: number;
  cuePath: string | null;
  wiredEvent: string | null;
  createdAt: number;
}
