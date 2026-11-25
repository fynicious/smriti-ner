import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { getNextAuthSecret } from '@/lib/env';
import { hashTokenSha256 } from '@/lib/crypto-envelope';
import { isWithinRateLimit, recordRateLimitAttempt, clearRateLimit } from '@/lib/rate-limit';

const MAX_LOGIN_ATTEMPTS = 10;
const MAX_PIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function checkLoginRateLimit(key: string, max = MAX_LOGIN_ATTEMPTS): boolean {
  return isWithinRateLimit(key, max);
}

function recordFailedLogin(key: string) {
  recordRateLimitAttempt(key, LOGIN_WINDOW_MS);
}

function clearLoginAttempts(key: string) {
  clearRateLimit(key);
}

const USER_PROFILE_INCLUDE = {
  patientProfile: true,
  caregiverProfile: {
    include: {
      patients: {
        where: { status: 'ACTIVE' },
        include: { patient: { select: { id: true, fullName: true } } },
      },
    },
  },
  clinicianProfile: true,
} as const;

function buildSessionUser(user: {
  id: string;
  email: string;
  role: string;
  patientProfile: { id: string; fullName: string } | null;
  caregiverProfile: {
    id: string;
    fullName: string;
    patients: Array<{ patient: { id: string; fullName: string } }>;
  } | null;
  clinicianProfile: { id: string; fullName: string } | null;
}) {
  let profileId: string | null = null;
  let name: string | null = null;
  let patients: { id: string; fullName: string }[] | undefined;

  if (user.role === 'PATIENT' && user.patientProfile) {
    profileId = user.patientProfile.id;
    name = user.patientProfile.fullName;
  } else if (user.role === 'CAREGIVER' && user.caregiverProfile) {
    profileId = user.caregiverProfile.id;
    name = user.caregiverProfile.fullName;
    patients = user.caregiverProfile.patients.map((p) => ({
      id: p.patient.id,
      fullName: p.patient.fullName,
    }));
  } else if (user.role === 'CLINICIAN' && user.clinicianProfile) {
    profileId = user.clinicianProfile.id;
    name = user.clinicianProfile.fullName;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    profileId,
    name,
    patients,
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        mode: { label: 'Mode', type: 'text' },
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        loginCode: { label: 'Patient Code', type: 'text' },
        pin: { label: 'PIN', type: 'password' },
        qrToken: { label: 'QR Token', type: 'text' },
      },
      async authorize(credentials) {
        const mode = credentials?.mode?.trim().toUpperCase() || 'PASSWORD';

        // Mode 1: Single-Use Caregiver QR Provisioning Token (+ optional PIN check)
        if (mode === 'QR_TOKEN') {
          const rawToken = credentials?.qrToken?.trim() || '';
          if (!rawToken || rawToken.length < 16) {
            throw new Error('Invalid or expired onboarding QR token');
          }
          const rateKey = `qr:${rawToken.slice(0, 12)}`;
          if (!checkLoginRateLimit(rateKey, MAX_PIN_ATTEMPTS)) {
            throw new Error('Too many QR onboarding attempts. Please wait 15 minutes.');
          }

          const tokenHash = hashTokenSha256(rawToken);
          const provision = await prisma.patientProvisionToken.findUnique({
            where: { tokenHash },
            include: {
              patient: {
                include: {
                  user: { include: USER_PROFILE_INCLUDE },
                },
              },
            },
          });

          if (!provision || provision.usedAt || new Date() > provision.expiresAt || !provision.patient?.user?.isActive) {
            recordFailedLogin(rateKey);
            throw new Error('Invalid or expired onboarding QR token');
          }

          const targetUser = provision.patient.user;
          const suppliedPin = credentials?.pin?.trim();
          if (targetUser.pinHash && suppliedPin) {
            const pinOk = await bcrypt.compare(suppliedPin, targetUser.pinHash);
            if (!pinOk) {
              recordFailedLogin(rateKey);
              throw new Error('Invalid patient PIN');
            }
          }

          await prisma.$transaction([
            prisma.patientProvisionToken.update({
              where: { id: provision.id },
              data: { usedAt: new Date() },
            }),
            prisma.patientProfile.update({
              where: { id: provision.patientId },
              data: { isAccountClaimed: true },
            }),
            prisma.auditLog.create({
              data: {
                userId: targetUser.id,
                action: 'PATIENT_QR_DEVICE_CLAIMED',
                resource: 'PatientProfile',
                resourceId: provision.patientId,
              },
            }),
          ]);

          clearLoginAttempts(rateKey);
          return buildSessionUser(targetUser);
        }

        // Mode 2: Elderly Patient Login via Caregiver-Assigned Short Code + 4–6 Digit PIN
        if (mode === 'PATIENT_PIN') {
          const loginCode = credentials?.loginCode?.trim().toUpperCase() || '';
          const pin = credentials?.pin?.trim() || '';

          if (!loginCode || !/^\d{4,6}$/.test(pin)) {
            throw new Error('Invalid patient code or PIN');
          }

          const rateKey = `pin:${loginCode}`;
          if (!checkLoginRateLimit(rateKey, MAX_PIN_ATTEMPTS)) {
            throw new Error('Too many failed PIN attempts. Ask your caregiver or wait 15 minutes.');
          }

          const user = await prisma.user.findUnique({
            where: { loginCode },
            include: USER_PROFILE_INCLUDE,
          });

          if (!user || !user.isActive || user.role !== 'PATIENT' || !user.pinHash) {
            recordFailedLogin(rateKey);
            throw new Error('Invalid patient code or PIN');
          }

          if (user.pinLockedUntil && new Date() < user.pinLockedUntil) {
            throw new Error('PIN temporarily locked for safety. Ask your caregiver to reset or wait 15 minutes.');
          }

          const pinValid = await bcrypt.compare(pin, user.pinHash);
          if (!pinValid) {
            const nextFails = user.pinFailedAttempts + 1;
            const lockUntil = nextFails >= MAX_PIN_ATTEMPTS ? new Date(Date.now() + LOGIN_WINDOW_MS) : null;
            await prisma.user.update({
              where: { id: user.id },
              data: {
                pinFailedAttempts: nextFails,
                ...(lockUntil ? { pinLockedUntil: lockUntil } : {}),
              },
            });
            recordFailedLogin(rateKey);
            throw new Error('Invalid patient code or PIN');
          }

          clearLoginAttempts(rateKey);
          if (user.pinFailedAttempts > 0 || user.pinLockedUntil) {
            await prisma.user.update({
              where: { id: user.id },
              data: { pinFailedAttempts: 0, pinLockedUntil: null },
            });
          }

          return buildSessionUser(user);
        }

        // Mode 3: Standard Email + Password Credentials (Caregiver / Clinician / Legacy User)
        const rawEmail = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;

        if (!rawEmail || !password) {
          throw new Error('Invalid email or password');
        }

        if (!checkLoginRateLimit(rawEmail)) {
          throw new Error('Too many failed login attempts. Please wait 15 minutes.');
        }

        const user = await prisma.user.findUnique({
          where: { email: rawEmail },
          include: USER_PROFILE_INCLUDE,
        });

        if (!user || !user.isActive) {
          recordFailedLogin(rawEmail);
          throw new Error('Invalid email or password');
        }

        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
          recordFailedLogin(rawEmail);
          throw new Error('Invalid email or password');
        }

        clearLoginAttempts(rawEmail);
        return buildSessionUser(user);
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.profileId = user.profileId;
        token.patients = user.patients;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = String(token.id || '');
        session.user.role = String(token.role || '');
        session.user.profileId = token.profileId ? String(token.profileId) : null;
        session.user.patients = Array.isArray(token.patients)
          ? (token.patients as { id: string; fullName: string }[])
          : undefined;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  },
  pages: {
    signIn: '/login',
  },
  secret: getNextAuthSecret(),
};
