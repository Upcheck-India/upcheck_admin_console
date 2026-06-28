import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html'
      }
    });
    
    clearTimeout(timeout);

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch URL' }, { status: response.status });
    }

    const html = await response.text();

    // Basic regex-based meta tag extraction (much faster than parsing a full DOM tree on Edge/Lambda)
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i) || html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const descMatch = html.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i) || html.match(/<meta\s+name="description"\s+content="([^"]+)"/i);
    const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i);

    const metadata = {
      url,
      title: titleMatch ? titleMatch[1].trim() : new URL(url).hostname,
      description: descMatch ? descMatch[1].trim() : '',
      image: imgMatch ? imgMatch[1].trim() : '',
    };

    return NextResponse.json(metadata);
  } catch (error) {
    console.error('Link preview error:', error);
    return NextResponse.json({ error: 'Failed to generate link preview' }, { status: 500 });
  }
}
