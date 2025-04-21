// Parses a message and splits it into regular text and code blocks
export function parseMessage(text) {
  const segments = [];
  const codeBlockRegex = /```(\w*)\n?([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(text)) !== null) {
    // Add text before code block if any
    if (match.index > lastIndex) {
      segments.push({
        type: 'text',
        content: text.substring(lastIndex, match.index)
      });
    }

    // Add code block
    segments.push({
      type: 'code',
      language: match[1] || null,
      content: match[2].trim()
    });

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text if any
  if (lastIndex < text.length) {
    segments.push({
      type: 'text',
      content: text.substring(lastIndex)
    });
  }

  return segments;
}