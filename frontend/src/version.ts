// Gerado automaticamente no momento do build
// Muda a cada novo deploy — use para comparar VPS vs local
export const BUILD_DATE: string = __BUILD_DATE__;

// Versão do app: "<versão do package.json>+<commit curto>" (ex.: "0.1.0+a1b2c3d").
// "+nogit" quando o build ocorre sem acesso ao repositório git.
export const APP_VERSION: string = __APP_VERSION__;

export function formatBuildDate(): string {
  const d = new Date(BUILD_DATE);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hour = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `build ${day}/${month}/${year} ${hour}:${min}`;
}
