import type { Readable } from "node:stream";

export const FILE_STORAGE = Symbol.for("@bartech/backend-files/storage");

export type StoredFileInput = {
  key: string;
  body: Buffer | Uint8Array | Readable;
  contentType: string;
  fileName: string;
};

export interface FileStorage {
  put(input: StoredFileInput): Promise<void>;
  get(key: string): Promise<Readable>;
  delete(key: string): Promise<void>;
  createDownloadUrl(key: string, fileName: string, expiresInSeconds: number): Promise<string>;
}
