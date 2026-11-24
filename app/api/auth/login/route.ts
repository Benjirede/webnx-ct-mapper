import { NextResponse } from 'next/server';
import db, { verifyPassword } from '@/app/lib/db';
import { signSession } from '@/app/lib/auth';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password required' }, { status: 400 });
    }

    const user = db
        .prepare('SELECT id, username, password_hash, role, must_change_password FROM users WHERE username = ?')
        .get(username.trim().toLowerCase()) as {
            id: number;
            username: string;
            password_hash: string;
            role: string;
            must_change_password: number;
        } | undefined;

    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const token = await signSession(user.username, user.role);
    const response = NextResponse.json({
      success: true,
      username: user.username,
      role: user.role,
      mustChangePassword: user.must_change_password === 1,
    });

    // secure: false is required so cookies save over plain HTTP on your local lab IP
    response.cookies.set('webnx_session', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: 60 * 60 * 24 * 14, // 14 days
    });

    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Authentication server error' }, { status: 500 });
  }
}
