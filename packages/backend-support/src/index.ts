export { SupportModule } from "./support.module.js";
export { SupportWorkerModule } from "./support-worker.module.js";
export {
  SupportService,
  SUPPORT_FILE_MAX_BYTES,
  SUPPORT_FILE_MAX_COUNT,
} from "./support.service.js";
export { SupportAccessService } from "./access/support-access.service.js";
export { SupportAccessModule } from "./access/support-access.module.js";
export type { SupportUploadFile } from "./support.service.js";
export {
  CreateSupportRequestDto,
  CreateSupportMessageDto,
  CreateInternalSupportMessageDto,
  MarkSupportMessagesReadDto,
  SupportAttachmentResponseDto,
  SupportMessageAccessGrantDto,
  SupportMessageResponseDto,
  SupportUnreadCountDto,
  SupportInternalUserResponseDto,
  SupportQueueQueryDto,
  SupportRequestQueuePageDto,
  SupportRequestQueueItemDto,
  SupportRequestResponseDto,
  UpdateSupportRequestDto,
} from "./support.dto.js";
