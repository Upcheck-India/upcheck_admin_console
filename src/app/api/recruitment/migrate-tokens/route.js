// src/app/api/recruitment/migrate-tokens/route.js
import { NextResponse } from 'next/server';
import clientPromise from "../../../../lib/mongodb";
import { v4 as uuidv4 } from 'uuid';

// This API route is for migrating existing candidates to have tokens
// It should be run once to update all existing candidates
export async function GET(req) {
  try {
    const client = await clientPromise;
    const db = client.db("recruitment");
    
    // Get all tests
    const tests = await db.collection('tests').find({}).toArray();
    let updatedCount = 0;
    
    // For each test, check candidates without tokens and update them
    for (const test of tests) {
      if (!test.candidates) continue;
      
      let hasUpdates = false;
      const updatedCandidates = test.candidates.map(candidate => {
        if (!candidate.token) {
          hasUpdates = true;
          updatedCount++;
          
          // Generate a token for this candidate
          const token = uuidv4();
          
          // Also create an invitation record if it doesn't exist
          db.collection('invitations').updateOne(
            { id: candidate.id },
            { 
              $set: {
                token,
                testId: test.id,
                email: candidate.email,
                name: candidate.name || candidate.email.split('@')[0],
                status: candidate.status || 'pending',
                sentAt: new Date(),
                expiresAt: test.dueDate ? new Date(test.dueDate) : null,
                completedAt: null,
                score: candidate.score || null
              }
            },
            { upsert: true }
          );
          
          return { ...candidate, token };
        }
        return candidate;
      });
      
      if (hasUpdates) {
        // Update the test with the new candidate data
        await db.collection('tests').updateOne(
          { id: test.id },
          { $set: { candidates: updatedCandidates } }
        );
      }
    }
    
    return NextResponse.json({ 
      success: true, 
      message: `Migration complete. Updated ${updatedCount} candidates with tokens.` 
    });
  } catch (error) {
    console.error('Migration error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
