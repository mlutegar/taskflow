import test from "node:test";
import assert from "node:assert/strict";
import { parseSnapshot, publishTaskEvent, subscribeTaskEvents, syncMetric, syncMetrics } from "./taskSyncInfrastructure.js";

test("parseSnapshot aceita JSON e rejeita valor inválido", () => {
  assert.deepEqual(parseSnapshot('{"ok":true}'), { ok: true });
  assert.equal(parseSnapshot("{"), null);
  assert.equal(parseSnapshot(null), null);
});

test("broker entrega apenas eventos do mesmo usuário e permite unsubscribe", () => {
  const received = [];
  const unsubscribe = subscribeTaskEvents("user-a", (event) => received.push(event));
  publishTaskEvent("user-b", { type: "task-changed", taskId: "2" });
  publishTaskEvent("user-a", { type: "task-changed", taskId: "1" });
  unsubscribe();
  publishTaskEvent("user-a", { type: "task-changed", taskId: "3" });
  assert.equal(received.length, 1);
  assert.equal(received[0].taskId, "1");
});

test("métricas de sincronização são incrementadas", () => {
  const before = syncMetrics().conflicts;
  syncMetric("conflicts");
  assert.equal(syncMetrics().conflicts, before + 1);
});
