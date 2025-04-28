import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

const contentQuestions = [
  {
    text: "What is the primary purpose of a content style guide?",
    type: "multiple-choice",
    options: [
      "To restrict creativity in content creation",
      "To ensure consistency and maintain brand voice across all content",
      "To make content creation more time-consuming",
      "To eliminate the need for content editors"
    ],
    correctAnswer: 1
  },
  {
    text: "When writing for the web, what is the most effective way to structure content?",
    type: "multiple-choice",
    options: [
      "Long paragraphs with detailed information",
      "Short, scannable sections with clear headings",
      "Single block of text without breaks",
      "Decorative fonts and complex layouts"
    ],
    correctAnswer: 1
  },
  {
    text: "What is the purpose of a call-to-action (CTA) in content?",
    type: "multiple-choice",
    options: [
      "To make the content longer",
      "To guide users toward taking a desired action",
      "To fill empty space on the page",
      "To showcase writing skills"
    ],
    correctAnswer: 1
  },
  {
    text: "Why is SEO important in content writing?",
    type: "multiple-choice",
    options: [
      "It makes the content more colorful",
      "It helps content rank better in search results and reach the target audience",
      "It makes the website load faster",
      "It reduces the need for editing"
    ],
    correctAnswer: 1
  },
  {
    text: "What is the importance of audience analysis in content creation?",
    type: "text",
    expectedKeywords: ["target audience", "needs", "preferences", "engagement", "relevance"]
  },
  {
    text: "How would you ensure content accessibility for users with disabilities?",
    type: "text",
    expectedKeywords: ["alt text", "headings", "structure", "screen readers", "contrast"]
  },
  {
    text: "What strategies would you use to maintain consistent brand voice across different content types?",
    type: "text",
    expectedKeywords: ["style guide", "tone", "messaging", "guidelines", "consistency"]
  },
  {
    text: "Explain how you would repurpose a long-form blog post into different content formats.",
    type: "text",
    expectedKeywords: ["social media", "infographic", "video", "summary", "newsletter"]
  },
  {
    text: "How do you measure the success of content marketing efforts?",
    type: "text",
    expectedKeywords: ["metrics", "analytics", "engagement", "conversion", "ROI"]
  },
  {
    text: "What role does storytelling play in content marketing?",
    type: "text",
    expectedKeywords: ["engagement", "connection", "emotion", "memorable", "brand"]
  },
  {
    text: "How do you optimize content for both search engines and human readers?",
    type: "text",
    expectedKeywords: ["keywords", "readability", "structure", "value", "natural"]
  },
  {
    text: "What are the key elements of an effective content strategy?",
    type: "text",
    expectedKeywords: ["goals", "audience", "channels", "metrics", "calendar"]
  },
  {
    text: "How do you handle content localization for different markets?",
    type: "text",
    expectedKeywords: ["culture", "translation", "adaptation", "context", "research"]
  },
  {
    text: "What is the importance of content hierarchy in web design?",
    type: "text",
    expectedKeywords: ["organization", "priority", "navigation", "user experience", "flow"]
  },
  {
    text: "How do you create content that drives user engagement?",
    type: "text",
    expectedKeywords: ["value", "relevance", "interaction", "call-to-action", "interest"]
  }
];

function getRandomQuestions(questions, count) {
  const shuffled = [...questions].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export async function GET(req, { params }) {
  try {
    const { role } = params;
    
    // Currently only supporting content role
    if (role !== 'content') {
      return NextResponse.json(
        { message: 'Role not available yet' },
        { status: 404 }
      );
    }
    
    // Select 10 random questions (4 multiple choice, 6 text)
    const multipleChoice = contentQuestions
      .filter(q => q.type === 'multiple-choice');
    const textQuestions = contentQuestions
      .filter(q => q.type === 'text');
    
    const selectedQuestions = [
      ...getRandomQuestions(multipleChoice, 4),
      ...getRandomQuestions(textQuestions, 6)
    ].sort(() => Math.random() - 0.5);
    
    // Remove correct answers and expected keywords before sending to client
    const sanitizedQuestions = selectedQuestions.map(({ correctAnswer, expectedKeywords, ...rest }) => rest);
    
    return NextResponse.json({
      questions: sanitizedQuestions
    });
  } catch (error) {
    console.error('Error fetching questions:', error);
    return NextResponse.json(
      { message: 'Failed to fetch questions' },
      { status: 500 }
    );
  }
}