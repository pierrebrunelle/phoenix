import {
  buildCopyCodeCreationMode,
  buildCopyLlmCreationMode,
  getEvaluatorInputSummaries,
  getLlmEvaluatorInputDescriptions,
  withInputDescriptions,
  type CodeProjectEvaluatorDetails,
  type LlmProjectEvaluatorDetails,
} from "@phoenix/pages/project/evaluators/projectEvaluatorOptions";
import { validateIdentifier } from "@phoenix/utils/identifierUtils";

const codeEvaluator = {
  __typename: "CodeEvaluator",
  id: "CodeEvaluator:1",
  name: "checks-output",
  description: "Checks the final answer",
  kind: "CODE",
  codeInputSchema: {
    type: "object",
    properties: { output: {} },
    required: ["output"],
  },
  inputs: [{ name: "output" }],
  language: "TYPESCRIPT",
  sourceCode: "function evaluate(output: string) { return output.length; }",
  sandboxConfig: { id: "SandboxConfig:1" },
  inputMapping: {
    pathMapping: { output: "output.value" },
    literalMapping: { threshold: 5 },
    descriptions: { output: "The final answer.", stale: "" },
  },
  outputConfigs: [
    {
      __typename: "ContinuousAnnotationConfig",
      name: "length",
      optimizationDirection: "MAXIMIZE",
      lowerBound: 0,
      upperBound: null,
    },
  ],
  " $fragmentType": "projectEvaluatorOptions_codeEvaluatorDetails",
} satisfies CodeProjectEvaluatorDetails;

const llmEvaluator = {
  __typename: "LLMEvaluator",
  id: "LLMEvaluator:1",
  name: "correctness",
  description: null,
  kind: "LLM",
  llmInputSchema: null,
  projectEvaluators: [
    { inputMapping: { descriptions: {} } },
    { inputMapping: { descriptions: { output: "The response to grade." } } },
  ],
  inputs: [],
  outputConfigs: [],
  promptVersion: {
    templateFormat: "MUSTACHE",
    template: {
      __typename: "PromptStringTemplate",
      template: "Is {{output}} correct?",
    },
    tools: null,
  },
  " $fragmentType": "projectEvaluatorOptions_llmEvaluatorDetails",
} satisfies LlmProjectEvaluatorDetails;

describe("buildCopyLlmCreationMode", () => {
  it("names the copy with a valid identifier the project does not use", () => {
    const built = buildCopyLlmCreationMode(llmEvaluator, ["correctness_copy"]);
    if (!built.ok) throw new Error("expected a copy");
    const { copyName } = built.mode.initialState;
    expect(copyName).toBe("correctness_copy_1");
    expect(validateIdentifier(copyName)).toBe(true);
  });

  it("carries the input descriptions of the evaluator's project binding", () => {
    const built = buildCopyLlmCreationMode(llmEvaluator, []);
    if (!built.ok) throw new Error("expected a copy");
    expect(built.mode.initialState.inputDescriptions).toEqual({
      output: "The response to grade.",
    });
  });
});

describe("getLlmEvaluatorInputDescriptions", () => {
  it("returns nothing when no binding describes its inputs", () => {
    expect(getLlmEvaluatorInputDescriptions({ projectEvaluators: [] })).toEqual(
      {}
    );
    expect(
      getLlmEvaluatorInputDescriptions({
        projectEvaluators: [{ inputMapping: { descriptions: "not a map" } }],
      })
    ).toEqual({});
  });
});

describe("withInputDescriptions", () => {
  it("overlays stored descriptions on declared inputs only", () => {
    expect(
      withInputDescriptions({
        inputs: [
          { name: "input", description: "From the schema" },
          { name: "output" },
        ],
        descriptions: { output: "The response", removed: "Gone" },
      })
    ).toEqual([
      { name: "input", description: "From the schema" },
      { name: "output", description: "The response" },
    ]);
  });
});

describe("buildCopyCodeCreationMode", () => {
  it("seeds a new code evaluator from the source definition", () => {
    expect(buildCopyCodeCreationMode(codeEvaluator, [])).toEqual({
      kind: "copyCode",
      initialState: {
        name: "checks-output",
        copyName: "checks-output_copy",
        description: "Checks the final answer",
        language: "TYPESCRIPT",
        sourceCode:
          "function evaluate(output: string) { return output.length; }",
        sandboxConfigId: "SandboxConfig:1",
        inputMapping: {
          pathMapping: { output: "output.value" },
          literalMapping: { threshold: 5 },
          descriptions: { output: "The final answer." },
        },
        outputConfigs: [
          {
            name: "length",
            optimizationDirection: "MAXIMIZE",
            lowerBound: 0,
            upperBound: null,
          },
        ],
      },
    });
  });

  it("allows the duplicate form to require a replacement sandbox", () => {
    expect(
      buildCopyCodeCreationMode(
        {
          ...codeEvaluator,
          sandboxConfig: null,
        },
        []
      ).initialState.sandboxConfigId
    ).toBeNull();
  });
});

describe("getEvaluatorInputSummaries", () => {
  it("returns names and descriptions without schema type metadata", () => {
    expect(
      getEvaluatorInputSummaries({
        type: "object",
        properties: {
          input: {
            type: "string",
            description: "The input to evaluate",
          },
          context: {},
          score: {
            anyOf: [{ type: "number" }, { type: "null" }],
          },
        },
      })
    ).toEqual([
      {
        name: "input",
        description: "The input to evaluate",
      },
      { name: "context", description: undefined },
      { name: "score", description: undefined },
    ]);
  });

  it("returns no inputs when the schema has no property map", () => {
    expect(getEvaluatorInputSummaries(null)).toEqual([]);
    expect(getEvaluatorInputSummaries({ type: "object" })).toEqual([]);
  });
});
