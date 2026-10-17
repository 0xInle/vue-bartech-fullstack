import { Global, Module } from "@nestjs/common";
import { FILE_STORAGE } from "./file-storage.js";
import { S3FileStorage } from "./s3-file-storage.js";

@Global()
@Module({
  providers: [S3FileStorage, { provide: FILE_STORAGE, useExisting: S3FileStorage }],
  exports: [FILE_STORAGE],
})
export class FileStorageModule {}
