/**
 * The server resolves every path in a mapping, declared or not, and a path
 * that matches nothing fails the run. So the project form keeps only the
 * variables the evaluator declares in the store, without losing what was
 * typed for one that is removed and then comes back.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { userEvent } from "storybook/test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useEvaluatorInputMappingControlsForm } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorInputVariablesContext } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { ProjectEvaluatorInputMappingDock } from "@phoenix/pages/project/evaluators/ProjectEvaluatorFormSections";
import { ProjectEvaluatorInputMapping } from "@phoenix/pages/project/evaluators/ProjectEvaluatorInputMapping";
import type { EvaluatorStoreInstance } from "@phoenix/store/evaluatorStore";

vi.mock("@phoenix/components/evaluators/EvaluatorPathField", () => ({
  EvaluatorPathField: ({ ariaLabel }: { ariaLabel: string }) => (
    <input aria-label={ariaLabel} readOnly />
  ),
}));

function DeclaredMappingForm({
  declaredVariables,
}: {
  declaredVariables: string[];
}) {
  useEvaluatorInputMappingControlsForm({
    pruneEmptyEntries: true,
    declaredVariables,
  });
  return null;
}

const STORED_PATHS = {
  context: "metadata.attributes.retrieval",
  input: "metadata.attributes.input",
};

const STORED_DESCRIPTIONS = {
  context: "Retrieved documents.",
  input: "The user's question.",
};

describe("a project evaluator's mapping as its variables change", () => {
  let container: HTMLDivElement;
  let root: Root;
  let store: EvaluatorStoreInstance | null;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    store = null;
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (declaredVariables: string[]) =>
    act(async () => {
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "LLM",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: {
                pathMapping: STORED_PATHS,
                literalMapping: {},
                descriptions: STORED_DESCRIPTIONS,
              },
            },
          }}
        >
          {({ store: storeInstance }) => {
            store = storeInstance;
            return (
              <DeclaredMappingForm declaredVariables={declaredVariables} />
            );
          }}
        </EvaluatorStoreProvider>
      );
    });

  it("leaves the stored mapping alone on open", async () => {
    // An evaluator opened and closed untouched must not read as edited.
    await render(["input"]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual(
      STORED_PATHS
    );
  });

  it("drops a removed variable's path and restores it when it returns", async () => {
    await render(["context", "input"]);
    await render(["input"]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual({
      input: STORED_PATHS.input,
    });
    await render(["context", "input"]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual(
      STORED_PATHS
    );
  });

  it("drops a removed variable's description and restores it when it returns", async () => {
    await render(["context", "input"]);
    await render(["input"]);
    expect(store!.getState().evaluator.inputMapping.descriptions).toEqual({
      input: STORED_DESCRIPTIONS.input,
    });
    await render(["context", "input"]);
    expect(store!.getState().evaluator.inputMapping.descriptions).toEqual(
      STORED_DESCRIPTIONS
    );
  });

  it("shows only declared variables as path-only mapping rows", async () => {
    await act(async () => {
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "LLM",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: { pathMapping: {}, literalMapping: {} },
            },
          }}
        >
          <EvaluatorInputVariablesContext.Provider
            value={["question", "rubric"]}
          >
            <ProjectEvaluatorInputMapping recordKind="span" />
          </EvaluatorInputVariablesContext.Provider>
        </EvaluatorStoreProvider>
      );
    });

    expect(
      [...container.querySelectorAll('input[aria-label$="path mapping"]')].map(
        (input) => input.getAttribute("aria-label")
      )
    ).toEqual(["question path mapping", "rubric path mapping"]);
    expect(container.querySelector("select")).toBeNull();
  });

  const renderDock = (
    declaredVariables: string[],
    evaluatorKind: "prompt" | "code" = "prompt"
  ) =>
    act(async () => {
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "LLM",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: { pathMapping: STORED_PATHS, literalMapping: {} },
            },
          }}
        >
          {({ store: storeInstance }) => {
            store = storeInstance;
            return (
              <EvaluatorInputVariablesContext.Provider
                value={declaredVariables}
              >
                <ProjectEvaluatorInputMappingDock
                  recordKind="span"
                  evaluatorKind={evaluatorKind}
                />
              </EvaluatorInputVariablesContext.Provider>
            );
          }}
        </EvaluatorStoreProvider>
      );
    });

  const dockBody = () => container.querySelector(".mapping-dock__body");

  it("opens the dock even when every variable already reads something", async () => {
    await renderDock(["input"]);
    expect(
      container.querySelector(".disclosure")?.getAttribute("data-expanded")
    ).toBe("true");
    expect(dockBody()?.textContent).toContain("Map evaluator variables");
  });

  it("says what the dock is for when nothing is declared", async () => {
    await renderDock([]);
    const text = dockBody()?.textContent ?? "";
    expect(text).toContain(
      "Variables in the prompt appear here, each mapped to the span data it reads."
    );
    // The mapping description is for rows; with none, it is left out.
    expect(text).not.toContain("Map evaluator variables");
  });

  it("words the dock's empty state for a code evaluator", async () => {
    await renderDock([], "code");
    expect(dockBody()?.textContent).toContain(
      "Parameters of the evaluator's function appear here"
    );
  });

  it("drops the last variable's path when the dock goes empty", async () => {
    await renderDock(["context", "input"]);
    await renderDock([]);
    expect(store!.getState().evaluator.inputMapping.pathMapping).toEqual({});
  });

  it("shows a stored description and saves one written in the describe popover", async () => {
    await act(async () => {
      root.render(
        <EvaluatorStoreProvider
          initialState={{
            evaluator: {
              kind: "LLM",
              globalName: "",
              name: "",
              description: "",
              isBuiltin: false,
              includeExplanation: false,
              inputMapping: {
                pathMapping: {},
                literalMapping: {},
                descriptions: { question: "What the user asked." },
              },
            },
          }}
        >
          {({ store: storeInstance }) => {
            store = storeInstance;
            return (
              <EvaluatorInputVariablesContext.Provider
                value={["question", "rubric"]}
              >
                <ProjectEvaluatorInputMapping recordKind="span" />
              </EvaluatorInputVariablesContext.Provider>
            );
          }}
        </EvaluatorStoreProvider>
      );
    });

    expect(container.textContent).toContain("What the user asked.");
    expect(
      container.querySelector(
        'button[aria-label="Edit description for question"]'
      )
    ).not.toBeNull();
    const describeRubric = container.querySelector(
      'button[aria-label="Add description for rubric"]'
    );

    const user = userEvent.setup();
    await act(async () => {
      await user.click(describeRubric!);
    });
    const textArea = document.body.querySelector("textarea");
    expect(textArea).not.toBeNull();
    await act(async () => {
      await user.type(textArea!, "  The grading rubric.  ");
      await user.click(document.body.querySelector('button[type="submit"]')!);
    });

    expect(container.textContent).toContain("The grading rubric.");
    expect(store!.getState().evaluator.inputMapping.descriptions).toEqual({
      question: "What the user asked.",
      rubric: "The grading rubric.",
    });
  });
});
