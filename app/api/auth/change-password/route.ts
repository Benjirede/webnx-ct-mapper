import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db, { hashPassword } from '@/app/lib/db';
import { signSession, verifySession } from '@/app/lib/auth';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('webnx_session')?.value;
  const session = await verifySession(token);

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json({ error: 'New password must be at least 8 characters' }, { status: 400 });
    }

    db.prepare(
      'UPDATE users SET password_hash = ?, must_change_password = 0 WHERE username = ?'
    ).run(hashPassword(newPassword), session.username);

    const newToken = await signSession(session.username, session.role);
    const response = NextResponse.json({ success: true });
    response.cookies.set('webnx_session', newToken, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 14,
    });

    return response;
  } catch {
    return NextResponse.json({ error: 'Failed to update password' }, { status: 500 });
  }
}
