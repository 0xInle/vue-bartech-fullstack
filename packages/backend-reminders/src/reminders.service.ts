import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { RemindersRepository } from "./reminders.repository.js";

export type VenueReminder = {
  id: string;
  text: string;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class RemindersService {
  constructor(private readonly reminders: RemindersRepository) {}

  list(userId: string, companyId: string, venueId: string): Promise<VenueReminder[]> {
    return this.reminders.findForUser(userId, companyId, venueId);
  }

  create(userId: string, companyId: string, venueId: string, text: string): Promise<VenueReminder> {
    const normalizedText = text.trim();
    if (!normalizedText) throw new BadRequestException("Текст напоминания не может быть пустым");
    return this.reminders.create(userId, companyId, venueId, normalizedText);
  }

  async setCompleted(
    id: string,
    userId: string,
    companyId: string,
    venueId: string,
    completed: boolean,
  ): Promise<VenueReminder> {
    const reminder = await this.reminders.setCompleted(id, userId, companyId, venueId, completed);
    if (!reminder) throw new NotFoundException("Напоминание не найдено");
    return reminder;
  }

  async delete(id: string, userId: string, companyId: string, venueId: string): Promise<void> {
    const deleted = await this.reminders.delete(id, userId, companyId, venueId);
    if (!deleted) throw new NotFoundException("Напоминание не найдено");
  }
}
