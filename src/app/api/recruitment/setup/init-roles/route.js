import { NextResponse } from 'next/server';
import clientPromrise from '../../../../../lib/mongodb';
import { cookies } from 'next/headers';

const initialRoles = [
  {
    id: 'jr-content-associate',
    name: 'Jr Content Associate',
    description: 'Entry-level content writing and management assessment',
    isActive: true,
    order: 1,
    questions: [
      {
        text: "What is the primary purpose of a content style guide?",
        type: "multiple-choice",
        difficulty: "easy",
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
        difficulty: "easy",
        options: [
          "Long paragraphs with detailed information",
          "Short, scannable sections with clear headings",
          "Single block of text without breaks",
          "Decorative fonts and complex layouts"
        ],
        correctAnswer: 1
      },
      {
        text: "What makes content accessible and easy to read?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["headings", "bullet points", "white space", "short paragraphs", "simple language"]
      },
      {
        text: "How would you optimize content for search engines while keeping it reader-friendly?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["keywords", "readability", "headings", "natural", "valuable", "structure"]
      },
      {
        text: "What is the importance of a call-to-action (CTA) in content?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "To make the content longer",
          "To guide users toward taking a desired action",
          "To fill empty space on the page",
          "To showcase writing skills"
        ],
        correctAnswer: 1
      }
    ]
  },
  {
    id: 'content',
    name: 'Content Management',
    description: 'Test for content writing, strategy, and management skills',
    isActive: true,
    order: 2,
    questions: [
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
    ]
  },
  {
    id: 'technical',
    name: 'Technical',
    description: 'Technical skills assessment for developers',
    isActive: false,
    order: 3,
    questions: []
  },
  {
    id: 'marketing',
    name: 'Marketing',
    description: 'Marketing strategy and execution assessment',
    isActive: false,
    order: 4,
    questions: []
  },
  {
    id: 'hr',
    name: 'Human Resources',
    description: 'HR management and practices assessment',
    isActive: false,
    order: 5,
    questions: []
  },
  {
    id: 'product',
    name: 'Product Management',
    description: 'Product strategy and management assessment',
    isActive: false,
    order: 6,
    questions: []
  }
];

export async function POST(req) {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin_token')?.value;

    if (!token) {
      return NextResponse.json(
        { message: 'Unauthorized' },
        { status: 401 }
      );
    }

    const client = await clientPromrise;
    const db = client.db("resources");

    // Verify the user is a Console admin
    const user = await db.collection('admin_users').findOne(
      { sessionToken: token },
      { projection: { role: 1 } }
    );

    if (!user || user.role !== 'Console admin') {
      return NextResponse.json(
        { message: 'Permission denied' },
        { status: 403 }
      );
    }

    // Initialize roles collection
    await db.collection('recruitment_roles').deleteMany({});
    await db.collection('recruitment_roles').insertMany(initialRoles);

    // Add recruitment.manage permission to Console admin and Admin roles
    await db.collection('admin_users').updateMany(
      { role: { $in: ['Console admin', 'Admin'] } },
      { $addToSet: { perms: 'recruitment.manage' } }
    );

    return NextResponse.json({
      success: true,
      message: 'Recruitment roles initialized successfully'
    });
  } catch (error) {
    console.error('Error initializing roles:', error);
    return NextResponse.json(
      { message: 'Failed to initialize recruitment roles' },
      { status: 500 }
    );
  }
}