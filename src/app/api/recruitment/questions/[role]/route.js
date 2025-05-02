import { NextResponse } from 'next/server';
import clientPromise from '../../../../../lib/mongodb';

const contentQuestions = {
  multipleChoice: {
    easy: [
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
        text: "What is the purpose of a call-to-action (CTA) in content?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "To make the content longer",
          "To guide users toward taking a desired action",
          "To fill empty space on the page",
          "To showcase writing skills"
        ],
        correctAnswer: 1
      },
      {
        text: "What does SEO stand for in content marketing?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "Systematic Editorial Operations",
          "Search Engine Optimization",
          "Social Engagement Opportunities",
          "Standard Editorial Objectives"
        ],
        correctAnswer: 1
      },
      {
        text: "Which of the following is the best practice for writing headlines?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "Use as many keywords as possible",
          "Make them mysterious to encourage clicks",
          "Be clear, specific, and concise",
          "Always use questions in headlines"
        ],
        correctAnswer: 2
      },
      {
        text: "What is a content pillar?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "A physical support for content marketing displays",
          "A comprehensive piece of content that can be broken into smaller pieces",
          "The main editor of a content team",
          "A tool for analyzing content performance"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the ideal reading level for most web content?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "College level (12th grade+)",
          "High school level (9th-12th grade)",
          "Middle school level (6th-8th grade)",
          "Elementary level (below 6th grade)"
        ],
        correctAnswer: 2
      },
      {
        text: "Which format is best for quickly scannable content?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "Long narrative paragraphs",
          "Bullet points and numbered lists",
          "Complex tables with detailed information",
          "Technical jargon and industry terms"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the primary purpose of alt text in images?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "To make images load faster",
          "To improve image quality",
          "To provide accessibility for screen readers",
          "To add keywords for better SEO rankings"
        ],
        correctAnswer: 2
      },
      {
        text: "What content format typically has the highest engagement rate?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "Plain text articles",
          "Video content",
          "Audio podcasts",
          "PDF documents"
        ],
        correctAnswer: 1
      },
      {
        text: "What is 'evergreen content'?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "Content about environmental issues",
          "Content with green-colored themes",
          "Content that remains relevant over a long period",
          "Content published in spring season"
        ],
        correctAnswer: 2
      },
      {
        text: "What is the purpose of a meta description?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "To secure copyright for content",
          "To summarize page content for search engines and users",
          "To create internal links within a website",
          "To track user behavior on a webpage"
        ],
        correctAnswer: 1
      },
      {
        text: "Which type of content typically performs best on social media?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "Technical whitepapers",
          "Long-form essays",
          "Visual content like images and videos",
          "Plain text updates"
        ],
        correctAnswer: 2
      },
      {
        text: "What is the primary difference between B2B and B2C content?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "B2B content is always longer than B2C content",
          "B2B focuses more on logic and ROI while B2C appeals more to emotions",
          "B2B doesn't use social media platforms",
          "B2C content never includes technical information"
        ],
        correctAnswer: 1
      },
      {
        text: "What is a content audit?",
        type: "multiple-choice",
        difficulty: "easy",
        options: [
          "A legal review of content",
          "An inventory and analysis of all existing content",
          "A budget report for content creation",
          "A test of website loading speed"
        ],
        correctAnswer: 1
      }
    ],
    medium: [
      {
        text: "Why is SEO important in content writing?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "It makes the content more colorful",
          "It helps content rank better in search results and reach the target audience",
          "It makes the website load faster",
          "It reduces the need for editing"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the most effective approach for writing for featured snippets?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Using complex technical language",
          "Providing concise, direct answers to specific questions",
          "Including as many keywords as possible",
          "Writing long-form content only"
        ],
        correctAnswer: 1
      },
      {
        text: "Which metric best indicates how engaging your content is?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Page views",
          "Time on page and scroll depth",
          "Social media followers",
          "Email list size"
        ],
        correctAnswer: 1
      },
      {
        text: "What is content syndication?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Creating content exclusively for your website",
          "Republishing content on other platforms to reach wider audiences",
          "Deleting outdated content",
          "Converting text content into video format"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the primary function of content mapping?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Creating geographical visualizations of where content is consumed",
          "Matching content types to specific stages of the buyer's journey",
          "Organizing content by publication date",
          "Tracking the physical location of content creators"
        ],
        correctAnswer: 1
      },
      {
        text: "Which approach best helps prevent content fatigue among audiences?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Publishing more content more frequently",
          "Varying content formats, topics, and distribution channels",
          "Using more technical terminology",
          "Focusing exclusively on written blog posts"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the primary purpose of A/B testing in content marketing?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "To test employees' content knowledge",
          "To compare two versions of content to see which performs better",
          "To determine the alphabetical order of content",
          "To create backup copies of content"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the 'skyscraper technique' in content marketing?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Creating very long-form content",
          "Finding successful content, making something better, and promoting it",
          "Using vertical layouts for all content",
          "Building content that focuses on tall buildings"
        ],
        correctAnswer: 1
      },
      {
        text: "What is content localization?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Restricting content to specific geographic areas",
          "Adapting content to specific locations or cultures, beyond just translation",
          "Using location-based keywords in content",
          "Publishing content only on local websites"
        ],
        correctAnswer: 1
      },
      {
        text: "What does 'AIDA' stand for in content marketing?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Automated Intelligent Data Analysis",
          "Attention, Interest, Desire, Action",
          "Analysis, Investigation, Decision, Application",
          "Audience, Interaction, Distribution, Amplification"
        ],
        correctAnswer: 1
      },
      {
        text: "Which principle best describes the 'content marketing funnel'?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "All content should be created in a chronological sequence",
          "Content should move users from awareness to consideration to decision",
          "The best content appears at the bottom of web pages",
          "Content should be filtered before publication"
        ],
        correctAnswer: 1
      },
      {
        text: "What is content atomization?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Breaking down content into the smallest possible units",
          "Breaking a large piece of content into multiple smaller pieces",
          "Analyzing content at atomic level",
          "Writing content about scientific topics"
        ],
        correctAnswer: 1
      },
      {
        text: "Which statement best describes the relationship between content marketing and inbound marketing?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "They are completely unrelated strategies",
          "Content marketing is a subset of inbound marketing",
          "Inbound marketing is a subset of content marketing",
          "They are different terms for the same concept"
        ],
        correctAnswer: 1
      },
      {
        text: "What is a cornerstone content piece?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "Content placed in the corner of a webpage",
          "A comprehensive resource that covers a core topic important to your audience",
          "The first piece of content you ever publish",
          "Content created by the foundation team of a company"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the primary purpose of a content calendar?",
        type: "multiple-choice",
        difficulty: "medium",
        options: [
          "To track content expiration dates",
          "To plan and organize content creation and publication",
          "To schedule social media posts only",
          "To count the number of content pieces created annually"
        ],
        correctAnswer: 1
      }
    ],
    hard: [
      {
        text: "Which content optimization technique would best address keyword cannibalization?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Creating more content targeting the same keyword",
          "Topic clustering with a pillar-and-cluster model",
          "Increasing keyword density in all articles",
          "Using the same meta descriptions across multiple pages"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the primary difference between TOFU, MOFU, and BOFU content?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "The technical complexity of the content",
          "The geographic targeting of the content",
          "The buyer's journey stage the content is aimed at",
          "The content format (video, text, or audio)"
        ],
        correctAnswer: 2
      },
      {
        text: "How does semantic search impact content strategy?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "It makes keyword research irrelevant",
          "It requires focusing on wider topic expertise rather than just keyword matching",
          "It means all content should be written using scientific terminology",
          "It suggests content should always be brief and concise"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the primary challenge of implementing a content governance framework?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Creating sufficient content volume",
          "Balancing standardization with flexibility for different content needs",
          "Finding skilled content creators",
          "Determining appropriate content length"
        ],
        correctAnswer: 1
      },
      {
        text: "Which approach best addresses content decay?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Creating new content to replace old content",
          "Systematic content auditing and refreshing of underperforming content",
          "Removing all content older than one year",
          "Changing the publication dates of old content"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the difference between content marketing and branded content?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "They are identical terms with no difference",
          "Content marketing focuses on providing value while branded content focuses on entertainment and brand story",
          "Branded content is free while content marketing is paid",
          "Content marketing is text-only while branded content is multimedia"
        ],
        correctAnswer: 1
      },
      {
        text: "What impact does the 'zero-click search' trend have on content strategy?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "It makes content optimization irrelevant",
          "It requires focusing more on featured snippets and knowledge panels",
          "It suggests all content should be behind paywalls",
          "It means content should always avoid answering direct questions"
        ],
        correctAnswer: 1
      },
      {
        text: "Which statement best explains the relationship between E-A-T and content quality?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "E-A-T only matters for health and financial content",
          "E-A-T focuses on page loading speed and technical SEO",
          "E-A-T (Expertise, Authoritativeness, Trustworthiness) is a key factor in how search engines evaluate content quality",
          "E-A-T only applies to video content"
        ],
        correctAnswer: 2
      },
      {
        text: "What is information architecture in the context of content strategy?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "The technical backend coding of a website",
          "The organization and structure of content to enhance findability and user experience",
          "The design of server infrastructure",
          "The process of backing up content"
        ],
        correctAnswer: 1
      },
      {
        text: "Which approach best applies the concept of 'content velocity'?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Publishing as much content as possible in a short timeframe",
          "The speed at which content loads on a webpage",
          "The efficient creation, management, and iteration of content across an organization",
          "Measuring how quickly users scroll through content"
        ],
        correctAnswer: 2
      },
      {
        text: "What does 'H-J-E-U principle' refer to in content optimization?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Help, Jump, Educate, Understand - a user journey framework",
          "Headings, JavaScript, Embeds, URLs - technical SEO elements",
          "Hero, Journey, End, Utility - storytelling structure",
          "Historical, Judicial, Educational, Universal - content categorization"
        ],
        correctAnswer: 0
      },
      {
        text: "What is the primary purpose of implementing content scoring?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "To grade writers on their grammar skills",
          "To quantitatively evaluate content performance against business objectives",
          "To rank content by publication date",
          "To calculate the reading level of content"
        ],
        correctAnswer: 1
      },
      {
        text: "How does the concept of 'content drift' affect a content strategy?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "It relates to how content moves across social platforms",
          "It describes gradual deviation from strategic content goals and brand voice",
          "It refers to content that changes based on user preferences",
          "It measures how quickly content becomes outdated"
        ],
        correctAnswer: 1
      },
      {
        text: "What is the most significant challenge in implementing a hub-and-spoke content model?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Creating visually appealing content",
          "Maintaining coherent relationships between hub and spoke content pieces",
          "Finding appropriate images for all content",
          "Keeping content under 500 words"
        ],
        correctAnswer: 1
      },
      {
        text: "What is meant by 'content atomization' in an omnichannel strategy?",
        type: "multiple-choice",
        difficulty: "hard",
        options: [
          "Creating entirely new content for each channel",
          "Breaking down core content into platform-appropriate formats across channels",
          "Using atomic imagery in all content",
          "Removing content from underperforming channels"
        ],
        correctAnswer: 1
      }
    ]
  },
  text: {
    easy: [
      {
        text: "Explain the difference between features and benefits in content writing.",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["features", "specifications", "benefits", "advantages", "customer", "solution", "value"]
      },
      {
        text: "How can you make technical content more accessible to a general audience?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["jargon", "simplify", "examples", "visuals", "analogies", "explanations"]
      },
      {
        text: "What are three best practices for writing effective email subject lines?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["concise", "personalization", "value", "curiosity", "urgency", "clarity", "specific"]
      },
      {
        text: "Describe how white space improves content readability.",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["breaks", "paragraphs", "scan", "overwhelming", "focus", "digest", "visual"]
      },
      {
        text: "What is the purpose of a content brief?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["guidance", "expectations", "requirements", "consistency", "direction", "objectives"]
      },
      {
        text: "Explain what a 'call to action' is and why it's important.",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["action", "prompt", "conversion", "next step", "instruction", "engagement"]
      },
      {
        text: "What are three common writing mistakes to avoid in marketing content?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["jargon", "passive voice", "long sentences", "errors", "inconsistency", "vague"]
      },
      {
        text: "How can bullet points improve content effectiveness?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["scannable", "digestible", "organized", "key points", "attention", "clarity"]
      },
      {
        text: "What is the difference between a blog post and an article?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["conversational", "formal", "length", "structure", "purpose", "tone"]
      },
      {
        text: "Explain the importance of proofreading content before publishing.",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["errors", "credibility", "professionalism", "clarity", "quality", "reputation"]
      },
      {
        text: "What is the role of a headline in content marketing?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["attention", "interest", "clickthrough", "first impression", "engagement", "promise"]
      },
      {
        text: "How can formatting enhance content readability?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["headings", "lists", "bold", "italics", "structure", "scannable", "hierarchy"]
      },
      {
        text: "What is a content calendar and why is it useful?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["planning", "schedule", "organization", "consistency", "topics", "deadlines"]
      },
      {
        text: "Explain the concept of content curation.",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["collect", "organize", "share", "relevant", "third-party", "value", "insights"]
      },
      {
        text: "What makes a testimonial effective in marketing content?",
        type: "text",
        difficulty: "easy",
        expectedKeywords: ["specific", "authentic", "results", "credibility", "relatable", "problem", "solution"]
      }
    ],
    medium: [
      {
        text: "What is the importance of audience analysis in content creation?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["target audience", "needs", "preferences", "engagement", "relevance", "persona", "demographics"]
      },
      {
        text: "How would you ensure content accessibility for users with disabilities?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["alt text", "headings", "structure", "screen readers", "contrast", "WCAG", "semantic"]
      },
      {
        text: "What strategies would you use to maintain consistent brand voice across different content types?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["style guide", "tone", "messaging", "guidelines", "consistency", "personality", "training"]
      },
      {
        text: "How do you create a content strategy that aligns with business goals?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["objectives", "KPIs", "audience", "journey", "measurement", "ROI", "conversion"]
      },
      {
        text: "Explain how you would repurpose a long-form blog post into different content formats.",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["social media", "infographic", "video", "summary", "newsletter", "podcast", "slideshow"]
      },
      {
        text: "How do you measure the success of content marketing efforts?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["metrics", "analytics", "engagement", "conversion", "ROI", "traffic", "attribution"]
      },
      {
        text: "What role does storytelling play in content marketing?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["engagement", "connection", "emotion", "memorable", "brand", "empathy", "relatability"]
      },
      {
        text: "How do you optimize content for both search engines and human readers?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["keywords", "readability", "structure", "value", "natural", "intent", "experience"]
      },
      {
        text: "What are the key elements of an effective content strategy?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["goals", "audience", "channels", "metrics", "calendar", "resources", "governance"]
      },
      {
        text: "How do you handle content localization for different markets?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["culture", "translation", "adaptation", "context", "research", "idioms", "preferences"]
      },
      {
        text: "What is the importance of content hierarchy in web design?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["organization", "priority", "navigation", "user experience", "flow", "importance", "structure"]
      },
      {
        text: "How do you create content that drives user engagement?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["value", "relevance", "interaction", "call-to-action", "interest", "emotion", "problem-solving"]
      },
      {
        text: "Describe a systematic approach to conducting a content audit.",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["inventory", "assessment", "metrics", "quality", "gaps", "recommendations", "performance"]
      },
      {
        text: "How would you develop a tone of voice guide for a brand?",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["personality", "attributes", "examples", "dos", "don'ts", "scenarios", "vocabulary"]
      },
      {
        text: "Explain the concept of content governance and why it matters.",
        type: "text",
        difficulty: "medium",
        expectedKeywords: ["standards", "processes", "roles", "quality", "consistency", "compliance", "workflow"]
      }
    ],
    hard: [
      {
        text: "How would you develop a content strategy for a product in a highly regulated industry?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["compliance", "legal review", "guidelines", "documentation", "claims", "transparency", "expertise", "authority"]
      },
      {
        text: "Describe how content strategy should evolve across different stages of a company's growth.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["scaling", "maturity", "resources", "specialization", "governance", "integration", "optimization", "diversification"]
      },
      {
        text: "How would you implement content personalization that balances effectiveness with privacy concerns?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["segmentation", "consent", "transparency", "data minimization", "value exchange", "progressive", "contextual"]
      },
      {
        text: "Explain how to develop a content distribution strategy that maximizes reach while maintaining efficiency.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["channels", "audience", "format", "timing", "promotion", "amplification", "repurposing", "analytics"]
      },
      {
        text: "How can competitive content analysis inform content strategy?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["gaps", "differentiation", "benchmarking", "positioning", "opportunity", "execution", "trends", "strengths"]
      },
      {
        text: "Describe how the content experience impacts customer journey and conversion.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["touchpoints", "consistency", "progression", "nurturing", "friction", "decision", "context", "relevance"]
      },
      {
        text: "How would you align content production processes across multiple teams and departments?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["workflow", "roles", "collaboration", "approvals", "templates", "calendar", "priorities", "communication"]
      },
      {
        text: "Explain the relationship between content strategy and information architecture.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["structure", "navigation", "taxonomy", "user flows", "findability", "categorization", "hierarchy", "labeling"]
      },
      {
        text: "How would you develop a framework for evaluating content ROI?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["attribution", "metrics", "touchpoints", "lifetime value", "conversion path", "investment", "benchmarks", "objectives"]
      },
      {
        text: "Describe how to implement voice search optimization in content strategy.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["conversational", "questions", "natural language", "featured snippets", "intent", "local", "context", "schema"]
      },
      {
        text: "How would you create a content strategy that effectively integrates AI-generated content?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["human oversight", "quality control", "authenticity", "editorial", "disclosure", "personalization", "scale", "ethics"]
      },
      {
        text: "Explain the concept of digital content accessibility and how to implement it holistically.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["WCAG", "inclusive design", "assistive technology", "testing", "semantic structure", "multimedia", "keyboard", "standards"]
      },
      {
        text: "How would you approach content strategy for an omnichannel customer experience?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["consistency", "channel-specific", "journey mapping", "integration", "handoffs", "personalization", "content hub", "adaptation"]
      },
      {
        text: "Describe how to build a content ecosystem that supports the entire customer lifecycle.",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["awareness", "consideration", "decision", "retention", "advocacy", "mapping", "touchpoints", "progression"]
      },
      {
        text: "How would you develop a strategy for content internationalization and globalization?",
        type: "text",
        difficulty: "hard",
        expectedKeywords: ["localization", "cultural adaptation", "translation workflow", "global templates", "regional", "consistency", "scalability", "governance"]
      }
    ]
  }
};

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
    
    // Select questions based on difficulty
    // 7 multiple choice (2 easy, 4 medium, 1 hard)
    const mcqEasy = getRandomQuestions(contentQuestions.multipleChoice.easy, 2);
    const mcqMedium = getRandomQuestions(contentQuestions.multipleChoice.medium, 4);
    const mcqHard = getRandomQuestions(contentQuestions.multipleChoice.hard, 1);

    // 3 text-based questions (1 easy, 1 medium, 1 hard)
    const textEasy = getRandomQuestions(contentQuestions.text.easy, 1);
    const textMedium = getRandomQuestions(contentQuestions.text.medium, 1);
    const textHard = getRandomQuestions(contentQuestions.text.hard, 1);

    const selectedQuestions = [
      ...mcqEasy,
      ...mcqMedium,
      ...mcqHard,
      ...textEasy,
      ...textMedium,
      ...textHard
    ].sort(() => Math.random() - 0.5);

    // Remove correct answers and expected keywords before sending to client
    const sanitizedQuestions = selectedQuestions.map(question => {
      const { correctAnswer, expectedKeywords, ...rest } = question;
      return rest;
    });

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