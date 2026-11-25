import 'next-auth';

export interface PairedPatientSummary {
  id: string;
  fullName: string;
}

declare module 'next-auth' {
  interface User {
    id: string;
    role: string;
    profileId: string | null;
    patients?: PairedPatientSummary[];
  }

  interface Session {
    user: User & {
      id: string;
      role: string;
      profileId: string | null;
      patients?: PairedPatientSummary[];
    };
  }
}
