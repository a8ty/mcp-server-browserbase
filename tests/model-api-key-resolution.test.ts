import { test } from "node:test";
import assert from "node:assert";
import { resolveModelApiKey } from "../src/config.ts";

// Save/override/restore env around each assertion so tests don't leak provider keys.
function withEnv(
  overrides: Record<string, string | undefined>,
  fn: () => void,
): void {
  const keys = Object.keys(overrides);
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
    if (overrides[k] === undefined) delete process.env[k];
    else process.env[k] = overrides[k];
  }
  try {
    fn();
  } finally {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
}

const ALL_UNSET = {
  ANTHROPIC_API_KEY: undefined,
  OPENAI_API_KEY: undefined,
  GEMINI_API_KEY: undefined,
  GOOGLE_API_KEY: undefined,
  GOOGLE_GENERATIVE_AI_API_KEY: undefined,
};

// The regression this guards: an Anthropic model must NOT receive a higher-priority
// provider key (OPENAI/GEMINI) that happens to be in the environment.
test("anthropic model selects ANTHROPIC_API_KEY even when OPENAI + GEMINI are present", () => {
  withEnv({ ...ALL_UNSET, ANTHROPIC_API_KEY: "sk-ant", OPENAI_API_KEY: "sk-openai", GEMINI_API_KEY: "AIza" }, () => {
    assert.equal(resolveModelApiKey("anthropic/claude-sonnet-4-6"), "sk-ant");
  });
});

test("gemini model selects the Google/Gemini key, not Anthropic/OpenAI", () => {
  withEnv({ ...ALL_UNSET, GEMINI_API_KEY: "AIza", ANTHROPIC_API_KEY: "sk-ant", OPENAI_API_KEY: "sk-openai" }, () => {
    assert.equal(resolveModelApiKey("gemini-2.0-flash"), "AIza");
  });
});

test("openai/gpt model selects OPENAI_API_KEY", () => {
  withEnv({ ...ALL_UNSET, OPENAI_API_KEY: "sk-openai", ANTHROPIC_API_KEY: "sk-ant" }, () => {
    assert.equal(resolveModelApiKey("gpt-4o"), "sk-openai");
  });
});

test("unknown model family preserves legacy precedence (Google > OpenAI > Anthropic)", () => {
  withEnv({ ...ALL_UNSET, GEMINI_API_KEY: "AIza", OPENAI_API_KEY: "sk-openai", ANTHROPIC_API_KEY: "sk-ant" }, () => {
    assert.equal(resolveModelApiKey("some-unknown-model"), "AIza");
  });
});

test("anthropic model with only mismatched keys returns undefined (no false positive)", () => {
  withEnv({ ...ALL_UNSET, OPENAI_API_KEY: "sk-openai", GEMINI_API_KEY: "AIza" }, () => {
    assert.equal(resolveModelApiKey("anthropic/claude-sonnet-4-6"), undefined);
  });
});
