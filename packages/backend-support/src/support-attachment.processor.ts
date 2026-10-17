import { Inject, Injectable, Logger } from "@nestjs/common";
import { FILE_STORAGE, type FileStorage } from "@bartech/backend-files";
import { ClamAvScanner } from "./clamav-scanner.js";
import { SupportAttachmentRepository } from "./support-attachment.repository.js";
import { SupportService } from "./support.service.js";

@Injectable()
export class SupportAttachmentProcessor {
  private readonly logger = new Logger(SupportAttachmentProcessor.name);

  constructor(
    private readonly repository: SupportAttachmentRepository,
    private readonly support: SupportService,
    private readonly scanner: ClamAvScanner,
    @Inject(FILE_STORAGE) private readonly storage: FileStorage,
  ) {}

  async process(attachmentId: string) {
    const attachment = await this.repository.findAttachment(attachmentId);
    if (!attachment || attachment.status !== "PENDING_SCAN") return;
    try {
      const stream = await this.storage.get(attachment.objectKey);
      const result = await this.scanner.scan(stream);
      await this.support.recordScanResult(
        attachmentId,
        result === "CLEAN" ? "CLEAN" : "REJECTED",
        result === "INFECTED" ? "INFECTED_FILE" : undefined,
      );
    } catch (error) {
      this.logger.warn(
        {
          attachmentId,
          errorType: error instanceof Error ? error.constructor.name : "UnknownError",
        },
        "Не удалось проверить вложение обращения",
      );
      throw error;
    }
  }
}
