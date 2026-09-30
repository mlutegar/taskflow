// Conflito otimista de versão de tarefa.
// Só há conflito quando o cliente informou uma versão e ela difere da
// armazenada. Sem versão enviada, aplica sem checar (retrocompatível).
export function isVersionConflict(storedVersion, clientVersion) {
  return clientVersion !== undefined && storedVersion !== clientVersion;
}
