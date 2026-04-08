import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createAdminClient } from "@/lib/supabase/admin";

function getFileExtension(contentType: string) {
  if (contentType.includes("png")) return "png";
  if (contentType.includes("webp")) return "webp";
  if (contentType.includes("gif")) return "gif";
  if (contentType.includes("svg")) return "svg";
  return "jpg";
}

export function isSupabaseStorageUrl(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return false;
  return url.startsWith(`${supabaseUrl}/storage/v1/object/public/`);
}

export function parseSupabaseStorageUrl(url: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) return null;

  const publicPrefix = `${supabaseUrl}/storage/v1/object/public/`;
  if (!url.startsWith(publicPrefix)) {
    return null;
  }

  const path = url.slice(publicPrefix.length);
  const firstSlash = path.indexOf("/");

  if (firstSlash === -1) {
    return null;
  }

  return {
    bucket: path.slice(0, firstSlash),
    objectPath: path.slice(firstSlash + 1),
  };
}

function getProjectRef() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  return new URL(supabaseUrl).hostname.split(".")[0];
}

function getPublicObjectUrl(bucket: string, path: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  return `${supabaseUrl}/storage/v1/object/public/${bucket}/${path}`;
}

function createSupabaseS3Client(sessionToken?: string) {
  const projectRef = getProjectRef();
  const endpoint =
    process.env.SUPABASE_S3_ENDPOINT ||
    `https://${projectRef}.storage.supabase.co/storage/v1/s3`;
  const region = process.env.SUPABASE_S3_REGION;
  const accessKeyId =
    process.env.SUPABASE_S3_ACCESS_KEY_ID || projectRef;
  const secretAccessKey =
    process.env.SUPABASE_S3_SECRET_ACCESS_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!region) {
    return null;
  }

  if (!accessKeyId || !secretAccessKey) {
    return null;
  }

  if (
    !process.env.SUPABASE_S3_ACCESS_KEY_ID &&
    !process.env.SUPABASE_S3_SECRET_ACCESS_KEY &&
    !sessionToken
  ) {
    return null;
  }

  return new S3Client({
    forcePathStyle: true,
    region,
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
      ...(sessionToken ? { sessionToken } : {}),
    },
  });
}

export async function uploadImageToSupabase(
  imageUrl: string,
  bookId: number,
  sessionToken?: string
): Promise<string> {
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.statusText}`);
  }

  const imageBlob = await imageResponse.blob();
  const contentType = imageResponse.headers.get("content-type") || "image/jpeg";

  if (!contentType.startsWith("image/")) {
    throw new Error(`Fetched URL is not an image: ${contentType}`);
  }

  const bucket = process.env.SUPABASE_S3_BUCKET || "images";
  const extension = getFileExtension(contentType);
  const fileName = `book-covers/${bookId}-${Date.now()}.${extension}`;
  const arrayBuffer = await imageBlob.arrayBuffer();

  const s3Client = createSupabaseS3Client(sessionToken);

  if (s3Client) {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: fileName,
        Body: new Uint8Array(arrayBuffer),
        ContentType: contentType,
      })
    );

    return getPublicObjectUrl(bucket, fileName);
  }

  const supabase = createAdminClient();

  const { error } = await supabase.storage
    .from(bucket)
    .upload(fileName, arrayBuffer, {
      contentType,
      upsert: true,
    });

  if (error) {
    throw new Error(`Supabase upload failed: ${error.message}`);
  }

  return getPublicObjectUrl(bucket, fileName);
}
