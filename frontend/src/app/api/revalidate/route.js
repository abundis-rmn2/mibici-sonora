import { revalidateTag } from 'next/cache';

export async function POST(request) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.SECRET_TOKEN;
  
  if (!secret) {
    return new Response('Server configuration error: missing SECRET_TOKEN', { status: 500 });
  }

  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    revalidateTag('stations-data');
    return new Response('OK', { status: 200 });
  } catch (error) {
    console.error('Failed to revalidate cache:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
}
