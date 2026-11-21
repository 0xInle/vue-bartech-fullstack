import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AnnouncementsRepository } from "./announcements.repository.js";

export type VenueAnnouncement = {
  id: string;
  title: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
};

type AnnouncementInput = { title: string; body: string };

@Injectable()
export class AnnouncementsService {
  constructor(private readonly announcements: AnnouncementsRepository) {}

  list(companyId: string, venueId: string): Promise<VenueAnnouncement[]> {
    return this.announcements.findForVenue(companyId, venueId);
  }

  create(
    userId: string,
    companyId: string,
    venueId: string,
    input: AnnouncementInput,
  ): Promise<VenueAnnouncement> {
    return this.announcements.create(userId, companyId, venueId, this.normalize(input));
  }

  async update(
    id: string,
    userId: string,
    companyId: string,
    venueId: string,
    input: AnnouncementInput,
  ): Promise<VenueAnnouncement> {
    const announcement = await this.announcements.update(
      id,
      userId,
      companyId,
      venueId,
      this.normalize(input),
    );
    if (!announcement) throw new NotFoundException("Объявление не найдено");
    return announcement;
  }

  async delete(id: string, userId: string, companyId: string, venueId: string): Promise<void> {
    const deleted = await this.announcements.delete(id, userId, companyId, venueId);
    if (!deleted) throw new NotFoundException("Объявление не найдено");
  }

  private normalize(input: AnnouncementInput): AnnouncementInput {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title) throw new BadRequestException("Укажите заголовок объявления");
    if (!body) throw new BadRequestException("Введите текст объявления");
    if (title.length > 100)
      throw new BadRequestException("Заголовок должен быть не длиннее 100 символов");
    if (body.length > 1000)
      throw new BadRequestException("Текст должен быть не длиннее 1000 символов");
    return { title, body };
  }
}
