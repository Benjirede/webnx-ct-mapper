import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import db, { hashPassword } from '@/app/lib/db';
import { verifySession } from '@/app/lib/auth';

const DEFAULT_PILOT_PASSWORD = 'Dontgivethis10ut';

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get('webnx_session')?.value;
  const session = await verifySession(token);

  if (!session || (session.role !== 'supervisor' && session.username !== 'admin')) {
    return NextResponse.json({ error: 'Supervisor role required to add testers' }, { status: 403 });
  }

  try {
    const { username } = await request.json();
    const cleanUsername = username?.trim().toLowerCase();

    if (!cleanUsername) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }

    db.prepare(
      'INSERT INTO users (username, password_hash, role, must_change_password) VALUES (?, ?, ?, 1)'
    ).run(cleanUsername, hashPassword(DEFAULT_PILOT_PASSWORD), 'tech');

    return NextResponse.json({
      success: true,
      username: cleanUsername,
      temporaryPassword: DEFAULT_PILOT_PASSWORD,
    });
  } catch (error: any) {
    if (error.message?.includes('UNIQUE')) {
      return NextResponse.json({ error: 'Username already exists' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
