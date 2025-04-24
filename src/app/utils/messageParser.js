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

    // Process code block content
    let codeContent = match[2].trim();
    
    // Preserve \n in print statements while formatting other newlines
    codeContent = codeContent.replace(/((System\.out\.)?print(ln|f)?\s*\(.*?\))/g, (match) => {
      // Temporarily replace \n in print statements with a placeholder
      return match.replace(/\\n/g, '__NEWLINE__');
    });

    // Now handle regular formatting
    codeContent = codeContent.replace(/\\n/g, '\n');

    // Restore \n in print statements
    codeContent = codeContent.replace(/__NEWLINE__/g, '\\n');

    // Add code block
    segments.push({
      type: 'code',
      language: match[1] || null,
      content: codeContent
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