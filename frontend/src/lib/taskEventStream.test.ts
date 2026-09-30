import { describe, expect, it } from "vitest";
import { parseSseBlock } from "./taskEventStream";

describe("parseSseBlock", () => {
  it("lê evento de tarefa", () => {
    expect(parseSseBlock('id: 1\nevent: task-change\ndata: {"type":"task-changed","taskId":"abc","id":1,"at":"now"}'))
      .toMatchObject({ type: "task-changed", taskId: "abc" });
  });

  it("ignora heartbeat e JSON inválido", () => {
    expect(parseSseBlock(": heartbeat")).toBeNull();
    expect(parseSseBlock("data: {")).toBeNull();
  });
});
