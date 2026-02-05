/**
 * Constants for Android Action Kernel.
 * All magic strings, URLs, and fixed values in one place.
 */

// ===========================================
// API Endpoints
// ===========================================
export const GROQ_API_BASE_URL = "https://api.groq.com/openai/v1";

// ===========================================
// ADB Key Codes
// ===========================================
export const KEYCODE_ENTER = "66";
export const KEYCODE_HOME = "KEYCODE_HOME";
export const KEYCODE_BACK = "KEYCODE_BACK";

// ===========================================
// Default Screen Coordinates (for swipe actions)
// Adjust based on target device resolution
// ===========================================
export const SCREEN_CENTER_X = 540;
export const SCREEN_CENTER_Y = 1200;

// Swipe coordinates: [start_x, start_y, end_x, end_y]
export const SWIPE_COORDS: Record<string, [number, number, number, number]> = {
  up: [SCREEN_CENTER_X, 1500, SCREEN_CENTER_X, 500],
  down: [SCREEN_CENTER_X, 500, SCREEN_CENTER_X, 1500],
  left: [800, SCREEN_CENTER_Y, 200, SCREEN_CENTER_Y],
  right: [200, SCREEN_CENTER_Y, 800, SCREEN_CENTER_Y],
};
export const SWIPE_DURATION_MS = "300";

// ===========================================
// Default Models
// ===========================================
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile";
export const DEFAULT_OPENAI_MODEL = "gpt-4o";
export const DEFAULT_BEDROCK_MODEL = "us.meta.llama3-3-70b-instruct-v1:0";

// ===========================================
// Bedrock Model Identifiers
// ===========================================
export const BEDROCK_ANTHROPIC_MODELS = ["anthropic"];
export const BEDROCK_META_MODELS = ["meta", "llama"];

// ===========================================
// File Paths
// ===========================================
export const DEVICE_DUMP_PATH = "/sdcard/window_dump.xml";
export const LOCAL_DUMP_PATH = "window_dump.xml";

// ===========================================
// Agent Defaults
// ===========================================
export const DEFAULT_MAX_STEPS = 10;
export const DEFAULT_STEP_DELAY = 2.0;
