/**
 * XML Sanitizer for Android Action Kernel.
 * Parses Android Accessibility XML and extracts interactive UI elements.
 */

import { XMLParser } from "fast-xml-parser";

export interface UIElement {
  id: string;
  text: string;
  type: string;
  bounds: string;
  center: [number, number];
  clickable: boolean;
  editable: boolean;
  action: "tap" | "type" | "read";
}

/**
 * Parses Android Accessibility XML and returns a lean list of interactive elements.
 * Calculates center coordinates (x, y) for every clickable element.
 */
export function getInteractiveElements(xmlContent: string): UIElement[] {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@_",
    allowBooleanAttributes: true,
  });

  let parsed: unknown;
  try {
    parsed = parser.parse(xmlContent);
  } catch {
    console.log("Warning: Error parsing XML. The screen might be loading.");
    return [];
  }

  const elements: UIElement[] = [];

  function walk(node: any): void {
    if (!node || typeof node !== "object") return;

    // Process current node if it has attributes
    if (node["@_bounds"]) {
      const isClickable = node["@_clickable"] === "true";
      const elementClass = node["@_class"] ?? "";
      const isEditable =
        elementClass.includes("EditText") ||
        elementClass.includes("AutoCompleteTextView") ||
        node["@_editable"] === "true";
      const text = node["@_text"] ?? "";
      const desc = node["@_content-desc"] ?? "";
      const resourceId = node["@_resource-id"] ?? "";

      // Skip empty layout containers
      if (!isClickable && !isEditable && !text && !desc) {
        // still walk children
      } else {
        const bounds: string = node["@_bounds"];
        try {
          const coords = bounds
            .replace("][", ",")
            .replace("[", "")
            .replace("]", "")
            .split(",")
            .map(Number);

          const [x1, y1, x2, y2] = coords;
          const centerX = Math.floor((x1 + x2) / 2);
          const centerY = Math.floor((y1 + y2) / 2);

          let suggestedAction: "tap" | "type" | "read";
          if (isEditable) suggestedAction = "type";
          else if (isClickable) suggestedAction = "tap";
          else suggestedAction = "read";

          elements.push({
            id: resourceId,
            text: text || desc,
            type: elementClass.split(".").pop() ?? "",
            bounds,
            center: [centerX, centerY],
            clickable: isClickable,
            editable: isEditable,
            action: suggestedAction,
          });
        } catch {
          // Skip malformed bounds
        }
      }
    }

    // Recurse into child nodes
    if (node.node) {
      const children = Array.isArray(node.node) ? node.node : [node.node];
      for (const child of children) {
        walk(child);
      }
    }

    // Also check if this is a hierarchy wrapper
    if (node.hierarchy) {
      walk(node.hierarchy);
    }
  }

  walk(parsed);
  return elements;
}
