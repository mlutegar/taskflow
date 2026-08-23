/**
 * mergeLocal.js — Mescla dados remotos com dados locais ainda não sincronizados.
 *
 * Evita que itens salvos offline (fire-and-forget) desapareçam quando o
 * backend responde sem eles. Itens que só existem localmente recebem a
 * flag `_local: true` para que a UI possa indicar estado pendente.
 *
 * @param {any[]|null} remote  Dados do backend (null = ainda carregando)
 * @param {any[]}      local   Dados do localStorage
 * @param {(item: any) => string} keyFn   Chave única por item
 * @param {(a: any, b: any) => number} [sortFn]  Ordenação (padrão: desc por date)
 * @returns {any[]}
 */
export function mergeLocal(
  remote: any[] | null,
  local: any[],
  keyFn: (item: any) => string,
  sortFn?: (a: any, b: any) => number
): any[] {
  if (remote === null) return local;
  const seen = new Set(remote.map(keyFn));
  const localOnly = local
    .filter(e => !seen.has(keyFn(e)))
    .map(e => ({ ...e, _local: true }));
  const merged = [...remote, ...localOnly];
  const defaultSort = (a: any, b: any) => (a.date < b.date ? 1 : -1);
  return merged.sort(sortFn ?? defaultSort);
}
