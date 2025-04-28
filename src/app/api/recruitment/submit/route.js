import { NextResponse } from 'next/server';
import clientPromise from '../../../../lib/mongodb';

const contentQuestions = [
  // ... copying the same questions array from questions/[role]/route.js ...
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

function calculateScore(answers, questions) {
  let score = 0;
  let possiblePoints = 0;
  
  answers.forEach((answer, index) => {
    const question = questions.find(q => q.text === answer.question);
    if (!question) return;

    if (question.type === 'multiple-choice') {
      possiblePoints += 10;
      if (answer.answer === question.options[question.correctAnswer]) {
        score += 10;
      }
    } else if (question.type === 'text') {
      possiblePoints += 10;
      const keywords = question.expectedKeywords;
      const answerText = answer.answer.toLowerCase();
      
      // Count how many keywords appear in the answer
      const foundKeywords = keywords.filter(keyword => 
        answerText.includes(keyword.toLowerCase())
      );
      
      // Score based on keyword matches (2 points per keyword, max 10)
      score += Math.min(foundKeywords.length * 2, 10);
    }
  });

  return Math.round((score / possiblePoints) * 100);
}

export async function POST(req) {
  try {
    const { applicantId, role, answers, timeSpent } = await req.json();
    
    const client = await clientPromise;
    const db = client.db("resources");
    
    // Get applicant info
    const applicant = await db.collection('applicants').findOne({ applicantId });
    if (!applicant) {
      return NextResponse.json(
        { message: 'Applicant not found' },
        { status: 404 }
      );
    }
    
    // Verify they haven't taken the test before
    if (applicant.hasAttempted) {
      return NextResponse.json(
        { message: 'Test has already been attempted' },
        { status: 400 }
      );
    }
    
    // Format answers for scoring
    const formattedAnswers = Object.entries(answers).map(([index, answer]) => ({
      question: contentQuestions[index].text,
      answer
    }));
    
    // Calculate score
    const score = calculateScore(formattedAnswers, contentQuestions);
    
    // Save test results
    const testResult = {
      applicantId,
      applicantName: applicant.name,
      role,
      answers: formattedAnswers,
      score,
      timeSpent,
      submittedAt: new Date()
    };
    
    await Promise.all([
      db.collection('test_attempts').insertOne(testResult),
      db.collection('applicants').updateOne(
        { applicantId },
        { $set: { hasAttempted: true } }
      )
    ]);
    
    return NextResponse.json({
      success: true,
      score,
      message: 'Test submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting test:', error);
    return NextResponse.json(
      { message: 'Failed to submit test' },
      { status: 500 }
    );
  }
}