import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifySession } from '@/app/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('webnx_session')?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  return NextResponse.json({
    authenticated: true,
    username: session.username,
    role: session.role,
  });
}
