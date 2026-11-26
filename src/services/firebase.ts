import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  doc,
  getDocFromServer,
  type Firestore,
} from 'firebase/firestore';
import defaultAppletConfig from '../../firebase-applet-config.json';

// Prioritize dedicated MASL VITE_FIREBASE_* environment variables (Vercel / external builds),
// falling back to provisioned firebase-applet-config.json for AI Studio runtime.
const envProjectId = import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim();
const usingCustomProject =
  Boolean(envProjectId) && envProjectId !== defaultAppletConfig.projectId;

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim() || defaultAppletConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim() || defaultAppletConfig.authDomain,
  projectId: envProjectId || defaultAppletConfig.projectId,
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim() || defaultAppletConfig.storageBucket,
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim() ||
    defaultAppletConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim() || defaultAppletConfig.appId,
};

const rawDatabaseId = usingCustomProject
  ? import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim() || ''
  : import.meta.env.VITE_FIREBASE_DATABASE_ID?.trim() ||
    defaultAppletConfig.firestoreDatabaseId?.trim() ||
    '';

const isDefaultDatabase =
  !rawDatabaseId ||
  rawDatabaseId.toLowerCase() === 'default' ||
  rawDatabaseId.toLowerCase() === '(default)';

const databaseId = isDefaultDatabase ? '(default)' : rawDatabaseId;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreInstance(): Firestore {
  const settings = {
    experimentalForceLongPolling: true,
    ignoreUndefinedProperties: true,
  };
  try {
    return isDefaultDatabase
      ? initializeFirestore(app, settings)
      : initializeFirestore(app, settings, databaseId);
  } catch {
    return isDefaultDatabase ? getFirestore(app) : getFirestore(app, databaseId);
  }
}

export const db = createFirestoreInstance();

export const activeFirebaseTarget = {
  projectId: firebaseConfig.projectId,
  databaseId,
};

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export function generateFirestoreId(prefix: string): string {
  const random = Math.random().toString(36).substring(2, 8);
  return `${prefix}_${Date.now()}_${random}`;
}
