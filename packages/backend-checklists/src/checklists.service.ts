import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ChecklistsRepository } from "./checklists.repository.js";

export type VenueChecklist = {
  id: string;
  title: string;
  steps: string[];
  createdAt: Date;
  updatedAt: Date;
};

type ChecklistInput = { title: string; steps: string[] };

@Injectable()
export class ChecklistsService {
  constructor(private readonly checklists: ChecklistsRepository) {}

  list(companyId: string, venueId: string): Promise<VenueChecklist[]> {
    return this.checklists.findForVenue(companyId, venueId);
  }

  create(userId: string, companyId: string, venueId: string, input: ChecklistInput) {
    return this.checklists.create(userId, companyId, venueId, this.normalize(input));
  }

  async update(
    id: string,
    userId: string,
    companyId: string,
    venueId: string,
    input: ChecklistInput,
  ) {
    const checklist = await this.checklists.update(
      id,
      userId,
      companyId,
      venueId,
      this.normalize(input),
    );
    if (!checklist) throw new NotFoundException("Чек-лист не найден");
    return checklist;
  }

  async delete(id: string, userId: string, companyId: string, venueId: string): Promise<void> {
    const deleted = await this.checklists.delete(id, userId, companyId, venueId);
    if (!deleted) throw new NotFoundException("Чек-лист не найден");
  }

  private normalize(input: ChecklistInput): ChecklistInput {
    const title = input.title.trim();
    const steps = input.steps.map((step) => step.trim());
    if (!title) throw new BadRequestException("Укажите название чек-листа");
    if (title.length > 100)
      throw new BadRequestException("Название должно быть не длиннее 100 символов");
    if (!steps.length || steps.some((step) => !step))
      throw new BadRequestException("Добавьте непустые пункты чек-листа");
    if (steps.length > 50)
      throw new BadRequestException("В чек-листе может быть не более 50 пунктов");
    if (steps.some((step) => step.length > 1000))
      throw new BadRequestException("Пункт не должен превышать 1000 символов");
    return { title, steps };
  }
}
