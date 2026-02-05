/**
 * Action execution module for Android Action Kernel.
 * Handles all ADB commands for interacting with Android devices.
 */

import { Config } from "./config.js";
import {
  KEYCODE_ENTER,
  KEYCODE_HOME,
  KEYCODE_BACK,
  SWIPE_COORDS,
  SWIPE_DURATION_MS,
} from "./constants.js";

export interface ActionDecision {
  action: string;
  coordinates?: [number, number];
  text?: string;
  direction?: string;
  reason?: string;
}

/**
 * Executes a shell command via ADB using Bun's native subprocess API.
 */
export function runAdbCommand(command: string[]): string {
  const result = Bun.spawnSync([Config.ADB_PATH, ...command], {
    stdout: "pipe",
    stderr: "pipe",
  });

  const stderr = result.stderr.toString();
  if (stderr && stderr.toLowerCase().includes("error")) {
    console.log(`ADB Error: ${stderr.trim()}`);
  }

  return result.stdout.toString().trim();
}

/**
 * Executes the action decided by the LLM.
 */
export function executeAction(action: ActionDecision): void {
  switch (action.action) {
    case "tap":
      executeTap(action);
      break;
    case "type":
      executeType(action);
      break;
    case "enter":
      executeEnter();
      break;
    case "swipe":
      executeSwipe(action);
      break;
    case "home":
      executeHome();
      break;
    case "back":
      executeBack();
      break;
    case "wait":
      executeWait();
      break;
    case "done":
      executeDone();
      break;
    default:
      console.log(`Warning: Unknown action: ${action.action}`);
  }
}

function executeTap(action: ActionDecision): void {
  const [x, y] = action.coordinates ?? [0, 0];
  console.log(`Tapping: (${x}, ${y})`);
  runAdbCommand(["shell", "input", "tap", String(x), String(y)]);
}

function executeType(action: ActionDecision): void {
  const text = action.text ?? "";
  // ADB requires %s for spaces
  const escapedText = text.replaceAll(" ", "%s");
  console.log(`Typing: ${text}`);
  runAdbCommand(["shell", "input", "text", escapedText]);
}

function executeEnter(): void {
  console.log("Pressing Enter");
  runAdbCommand(["shell", "input", "keyevent", KEYCODE_ENTER]);
}

function executeSwipe(action: ActionDecision): void {
  const direction = action.direction ?? "up";
  const coords = SWIPE_COORDS[direction] ?? SWIPE_COORDS["up"];

  console.log(`Swiping ${direction.charAt(0).toUpperCase() + direction.slice(1)}`);
  runAdbCommand([
    "shell",
    "input",
    "swipe",
    String(coords[0]),
    String(coords[1]),
    String(coords[2]),
    String(coords[3]),
    SWIPE_DURATION_MS,
  ]);
}

function executeHome(): void {
  console.log("Going Home");
  runAdbCommand(["shell", "input", "keyevent", KEYCODE_HOME]);
}

function executeBack(): void {
  console.log("Going Back");
  runAdbCommand(["shell", "input", "keyevent", KEYCODE_BACK]);
}

function executeWait(): void {
  console.log("Waiting...");
  Bun.sleepSync(2000);
}

function executeDone(): void {
  console.log("Goal Achieved.");
  process.exit(0);
}
