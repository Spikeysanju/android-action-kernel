/**
 * Android Action Kernel - Main Agent Loop (TypeScript/Bun Edition)
 *
 * An AI agent that controls Android devices through the accessibility API.
 * Uses LLMs to make decisions based on screen context.
 *
 * Usage:
 *     bun run src/kernel.ts
 */

import { existsSync, readFileSync } from "fs";

import { Config } from "./config.js";
import { executeAction, runAdbCommand, type ActionDecision } from "./actions.js";
import { getLlmProvider } from "./llm-providers.js";
import { getInteractiveElements } from "./sanitizer.js";

/**
 * Dumps the current UI XML and returns the sanitized JSON string.
 */
function getScreenState(): string {
  // 1. Capture XML from device
  runAdbCommand(["shell", "uiautomator", "dump", Config.SCREEN_DUMP_PATH]);

  // 2. Pull to local machine
  runAdbCommand(["pull", Config.SCREEN_DUMP_PATH, Config.LOCAL_DUMP_PATH]);

  // 3. Read & Sanitize
  if (!existsSync(Config.LOCAL_DUMP_PATH)) {
    return "Error: Could not capture screen.";
  }

  const xmlContent = readFileSync(Config.LOCAL_DUMP_PATH, "utf-8");
  const elements = getInteractiveElements(xmlContent);
  return JSON.stringify(elements, null, 2);
}

/**
 * Main agent loop: Perceive -> Reason -> Act
 */
async function runAgent(goal: string, maxSteps?: number): Promise<void> {
  const steps = maxSteps ?? Config.MAX_STEPS;

  console.log("Android Action Kernel Started");
  console.log(`Goal: ${goal}`);
  console.log(`Provider: ${Config.LLM_PROVIDER} (${Config.getModel()})`);

  // Initialize LLM provider
  const llm = getLlmProvider();
  const actionHistory: ActionDecision[] = [];

  for (let step = 0; step < steps; step++) {
    console.log(`\n--- Step ${step + 1}/${steps} ---`);

    // 1. Perception: Capture screen state
    console.log("Scanning Screen...");
    const screenContext = getScreenState();

    // 2. Reasoning: Get LLM decision
    console.log("Thinking...");
    const decision = await llm.getDecision(goal, screenContext, actionHistory);
    console.log(`Decision: ${decision.reason ?? "No reason provided"}`);

    // 3. Action: Execute the decision
    executeAction(decision);

    // Track action history for context
    actionHistory.push(decision);

    // Wait for UI to update
    await Bun.sleep(Config.STEP_DELAY * 1000);
  }

  console.log("\nMax steps reached. Task may be incomplete.");
}

/**
 * Entry point for the Android Action Kernel.
 */
async function main(): Promise<void> {
  try {
    Config.validate();
  } catch (e) {
    console.log(`Configuration Error: ${(e as Error).message}`);
    return;
  }

  // Read user input from stdin
  process.stdout.write("Enter your goal: ");
  const goal = await new Promise<string>((resolve) => {
    const reader = Bun.stdin.stream().getReader();
    reader.read().then(({ value }) => {
      resolve(new TextDecoder().decode(value).trim());
      reader.releaseLock();
    });
  });

  if (!goal) {
    console.log("No goal provided. Exiting.");
    return;
  }

  await runAgent(goal);
}

main();
