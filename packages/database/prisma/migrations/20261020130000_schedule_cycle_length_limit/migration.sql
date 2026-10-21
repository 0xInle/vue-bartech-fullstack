ALTER TABLE "schedule_template_versions"
  DROP CONSTRAINT "schedule_template_versions_cycle_check";

ALTER TABLE "schedule_template_versions"
  ADD CONSTRAINT "schedule_template_versions_cycle_check"
  CHECK (
    "workDays" BETWEEN 1 AND 31
    AND "offDays" BETWEEN 0 AND 30
    AND "workDays" + "offDays" BETWEEN 1 AND 31
  ) NOT VALID;
