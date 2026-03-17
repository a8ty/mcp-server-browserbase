import { z } from "zod";
import type { Tool, ToolSchema, ToolResult } from "./tool.js";
import type { Context } from "../context.js";
import type { ToolActionResult } from "../types/types.js";

/**
 * Stagehand Agent
 * Docs: https://docs.stagehand.dev/basics/agent
 *
 * This tool uses Computer Use Agent (CUA) mode to autonomously complete web-based tasks.
 * The agent will navigate, interact, and complete the task described in the prompt.
 * Supports Anthropic (claude-sonnet-4-6), Gemini, and other CUA-capable models.
 */

const AgentInputSchema = z.object({
  prompt: z.string().describe(
    `The task prompt describing what you want the sub-agent to accomplish.
    Be clear and specific about the goal. For example:
    'Go to Hacker News and find the most controversial post from today, then summarize the top 3 comments'.
    The agent will autonomously navigate and interact with web pages to complete this task.`,
  ),
});

type AgentInput = z.infer<typeof AgentInputSchema>;

const agentSchema: ToolSchema<typeof AgentInputSchema> = {
  name: "browserbase_stagehand_agent",
  description: `Execute a task autonomously using Computer Use Agent (CUA). The agent will navigate and interact with web pages to complete the given task. Supports Anthropic, Gemini, and other CUA-capable models.`,
  inputSchema: AgentInputSchema,
};

async function handleAgent(
  context: Context,
  params: AgentInput,
): Promise<ToolResult> {
  const action = async (): Promise<ToolActionResult> => {
    try {
      const stagehand = await context.getStagehand();

      // CUA model configurable via env vars (default: Anthropic claude-sonnet-4-6)
      const cuaModel =
        process.env.CUA_MODEL || "anthropic/claude-sonnet-4-6";
      const cuaApiKey =
        process.env.CUA_API_KEY ||
        process.env.ANTHROPIC_API_KEY ||
        process.env.GEMINI_API_KEY ||
        process.env.GOOGLE_API_KEY ||
        process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      const agent = stagehand.agent({
        mode: "cua",
        model: {
          modelName: cuaModel,
          apiKey: cuaApiKey,
        },
      });

      // Execute the task
      const result = await agent.execute({
        instruction: params.prompt,
        maxSteps: 20,
      });

      return {
        content: [
          {
            type: "text",
            text: `${result.message}`,
          },
        ],
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to execute agent task: ${errorMsg}`);
    }
  };

  return {
    action,
    waitForNetwork: false,
  };
}

const agentTool: Tool<typeof AgentInputSchema> = {
  capability: "core",
  schema: agentSchema,
  handle: handleAgent,
};

export default agentTool;
