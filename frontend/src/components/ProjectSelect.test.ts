import { describe, expect, it } from "vitest";
import { flattenProjects } from "./ProjectSelect";
import type { Project } from "../api/projects";

const project = (id: string, name: string, parent_id: string | null = null): Project => ({
  id, name, parent_id, description: null, color: "#7c6ef5", emoji: "📁",
  archived: false, task_count: 0, child_count: 0,
});

describe("flattenProjects", () => {
  it("ordena uma hierarquia e gera caminhos legíveis", () => {
    const rows = flattenProjects([
      project("visual", "Computação Visual", "faculdade"),
      project("faculdade", "Faculdade"),
      project("mrender", "Mrender"),
      project("comp", "Compiladores", "faculdade"),
    ]);

    expect(rows.map((row) => [row.name, row.depth, row.path])).toEqual([
      ["Faculdade", 0, "Faculdade"],
      ["Compiladores", 1, "Faculdade / Compiladores"],
      ["Computação Visual", 1, "Faculdade / Computação Visual"],
      ["Mrender", 0, "Mrender"],
    ]);
  });

  it("não trava com dados órfãos ou cíclicos", () => {
    const rows = flattenProjects([project("a", "A", "b"), project("b", "B", "a")]);
    expect(new Set(rows.map((row) => row.id))).toEqual(new Set(["a", "b"]));
  });
});
