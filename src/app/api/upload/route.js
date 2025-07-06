import { writeFile, mkdir } from 'fs/promises';
import { NextResponse } from 'next/server';
import path from 'path';

export async function POST(request) {
  try {
    const data = await request.formData();
    const file = data.get('file');

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded.' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Ensure the uploads directory exists in the 'public' folder
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // The directory already exists, which is fine.
      if (e.code !== 'EEXIST') {
        console.error('Failed to create upload directory:', e);
        throw new Error('Could not create upload directory.');
      }
    }

    // Create a unique filename to prevent overwriting existing files
    const filename = `${Date.now()}-${file.name.replace(/\s+/g, '_')}`;
    const filePath = path.join(uploadDir, filename);

    // Write the file to the server
    await writeFile(filePath, buffer);

    // Return the public path so it can be accessed from the browser
    const publicPath = `/uploads/${filename}`;
    return NextResponse.json({ success: true, filePath: publicPath });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json({ error: 'Error uploading file.' }, { status: 500 });
  }
}