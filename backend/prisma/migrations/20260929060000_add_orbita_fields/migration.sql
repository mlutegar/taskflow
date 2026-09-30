-- AlterTable: campos de integração com o Órbita (Claude Web)
ALTER TABLE "tasks" ADD COLUMN "orbita_projects" TEXT;
ALTER TABLE "tasks" ADD COLUMN "orbita_prompt" TEXT;
