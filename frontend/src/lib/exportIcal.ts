import { api } from "./apiClient";

/**
 * Exporta tarefas anuais como arquivo .ics (iCalendar)
 */
export async function exportYearlyTasksToCalendar(): Promise<void> {
  try {
    const response = await fetch(`${api.baseURL}/ical/yearly`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
    });

    if (!response.ok) {
      throw new Error("Erro ao gerar arquivo de calendário");
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tarefas-anuais.ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Erro ao exportar tarefas anuais:", error);
    throw error;
  }
}
