/** Bound both line count and text size, including unusually large log messages. */
export function createLogBuffer(maxLines = 10_000, maxCharacters = 2 * 1024 * 1024) {
  let lines: string[] = [];
  let characters = 0;
  return {
    append(message: string) {
      // Bound parsing work per message before splitting it into individual lines.
      const incoming = message.slice(-maxCharacters).split("\n")
        .filter((line) => line.trim()).slice(-maxLines).map((line) => line.slice(0, Math.min(4096, maxCharacters)));
      lines = lines.concat(incoming);
      characters += incoming.reduce((sum, line) => sum + line.length, 0);
      let drop = 0;
      while (lines.length - drop > maxLines || characters > maxCharacters) characters -= lines[drop++].length;
      if (drop) lines = lines.slice(drop);
    },
    snapshot: () => [...lines],
    clear() { lines = []; characters = 0; },
  };
}
