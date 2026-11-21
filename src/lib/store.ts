import "server-only";
import { promises as fs } from "fs";
import path from "path";
import { get, put, BlobAccessError, BlobError, BlobPreconditionFailedError, BlobStoreNotFoundError } from "@vercel/blob";
import { SetupError } from "./errors";

/**
 * JSON-file storage.
 *
 * - On Vercel (or whenever BLOB_READ_WRITE_TOKEN is set) each collection is a
 *   private JSON file in Vercel Blob: data/<name>.json. Writes are conditional
 *   on the ETag we read, so two roommates saving at once never clobber each
 *   other — the loser simply re-reads and re-applies its change.
 * - Locally without a token, files live in ./.data/<name>.json.
 */

export type Collection =
  | "users"
  | "settings"
  | "recipes"
  | "fridge"
  | "meals"
  | "shopping"
  | "usage";

// Connecting a Blob store in Vercel sets BLOB_READ_WRITE_TOKEN, or BLOB_STORE_ID
// (credentials then come from Vercel's built-in OIDC token). Either works.
const blobEnabled = () => Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
const blobPath = (name: Collection) => `data/${name}.json`;
const localDir = () => path.join(process.cwd(), ".data");
const localPath = (name: Collection) => path.join(localDir(), `${name}.json`);

function assertWritableEnv() {
  if (!blobEnabled() && process.env.VERCEL) {
    throw new SetupError(
      "connect a Vercel Blob store (Private access) to this project under Storage, then redeploy.",
    );
  }
}

/** Turn storage misconfiguration into a clear setup message (and log the original). */
function explainBlobError(err: unknown): never {
  if (err instanceof BlobStoreNotFoundError) {
    console.error(err);
    throw new SetupError("the connected Vercel Blob store no longer exists. Connect a new Private store, then redeploy.");
  }
  if (err instanceof BlobAccessError || (err instanceof BlobError && /public|private|access/i.test(err.message))) {
    console.error(err);
    // Household data must never sit in a public store.
    throw new SetupError("the Vercel Blob store must use Private access. Create a Private store, connect it, then redeploy.");
  }
  if (err instanceof BlobError && /credentials|token/i.test(err.message)) {
    console.error(err);
    throw new SetupError("Vercel Blob credentials are missing. Reconnect the Blob store to this project, then redeploy.");
  }
  throw err;
}

interface Snapshot<T> {
  data: T;
  etag: string | null;
}

async function readRaw<T>(name: Collection, fallback: T): Promise<Snapshot<T>> {
  assertWritableEnv();
  if (blobEnabled()) {
    const res = await get(blobPath(name), { access: "private", useCache: false }).catch(explainBlobError);
    if (!res || res.statusCode !== 200) return { data: fallback, etag: null };
    const text = await new Response(res.stream).text();
    return { data: JSON.parse(text) as T, etag: res.blob.etag };
  }
  try {
    const text = await fs.readFile(localPath(name), "utf8");
    return { data: JSON.parse(text) as T, etag: null };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { data: fallback, etag: null };
    throw err;
  }
}

export async function read<T>(name: Collection, fallback: T): Promise<T> {
  return (await readRaw(name, fallback)).data;
}

// Serialises local-file writes within one process.
const localLocks = new Map<Collection, Promise<unknown>>();

/**
 * Read-modify-write a collection. `fn` receives the current data and returns
 * the new data plus an optional result value. It may run more than once if
 * another write lands first, so keep it free of side effects.
 */
export async function update<T, R = void>(
  name: Collection,
  fallback: T,
  fn: (current: T) => { data: T; result?: R } | Promise<{ data: T; result?: R }>,
): Promise<R> {
  assertWritableEnv();
  if (blobEnabled()) {
    for (let attempt = 0; attempt < 6; attempt++) {
      const snap = await readRaw(name, structuredClone(fallback));
      const { data, result } = await fn(snap.data);
      try {
        await put(blobPath(name), JSON.stringify(data, null, 2), {
          access: "private",
          contentType: "application/json",
          addRandomSuffix: false,
          ...(snap.etag ? { ifMatch: snap.etag } : { allowOverwrite: false }),
          cacheControlMaxAge: 60,
        });
        return result as R;
      } catch (err) {
        const conflict =
          err instanceof BlobPreconditionFailedError ||
          // creating a file that someone else just created
          (!snap.etag && err instanceof Error && /already exists/i.test(err.message));
        if (!conflict) explainBlobError(err);
        await new Promise((r) => setTimeout(r, 50 + Math.random() * 150));
      }
    }
    throw new Error(`Could not save ${name}: too many simultaneous edits, try again.`);
  }

  const prev = localLocks.get(name) ?? Promise.resolve();
  const run = prev.then(async () => {
    const snap = await readRaw(name, structuredClone(fallback));
    const { data, result } = await fn(snap.data);
    await fs.mkdir(localDir(), { recursive: true });
    const tmp = `${localPath(name)}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, localPath(name));
    return result as R;
  });
  localLocks.set(name, run.catch(() => undefined));
  return run;
}
