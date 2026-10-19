import prisma from "../prisma.js";
import { authenticate } from "../auth.js";

/**
 * Gera arquivo .ics (iCalendar) com tarefas anuais recorrentes.
 * @param {import('fastify').FastifyInstance} fastify
 */
export default async function icalRoutes(fastify) {
  // GET /ical/yearly
  fastify.get("/yearly", { preHandler: authenticate }, async (req, reply) => {
    const userId = req.userId;

    const tasks = await prisma.task.findMany({
      where: {
        createdBy: userId,
        deletedAt: null,
        recurrence: "yearly",
      },
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        recurrenceRule: true,
        createdAt: true,
      },
    });

    // Gerar arquivo .ics
    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//TaskFlow//Yearly Tasks//PT",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:Tarefas Anuais - TaskFlow",
      "X-WR-TIMEZONE:America/Sao_Paulo",
    ];

    tasks.forEach((task) => {
      const dueDate = task.dueDate || task.createdAt;
      const dtstart = dueDate.toISOString().split("T")[0].replace(/-/g, "");
      const uid = `yearly-task-${task.id}@taskflow`;
      const dtstamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

      lines.push(
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${dtstamp}`,
        `DTSTART;VALUE=DATE:${dtstart}`,
        `SUMMARY:${escapeIcal(task.title)}`,
        task.description ? `DESCRIPTION:${escapeIcal(task.description)}` : null,
        "RRULE:FREQ=YEARLY",
        "END:VEVENT"
      );
    });

    lines.push("END:VCALENDAR");

    const ical = lines.filter(Boolean).join("\r\n");

    reply
      .header("Content-Type", "text/calendar; charset=utf-8")
      .header("Content-Disposition", 'attachment; filename="tarefas-anuais.ics"')
      .send(ical);
  });
}

/**
 * Escapa caracteres especiais para formato iCalendar.
 * @param {string | null | undefined} text
 * @returns {string}
 */
function escapeIcal(text) {
  if (!text) return "";
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}
