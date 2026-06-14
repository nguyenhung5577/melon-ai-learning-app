import { NextRequest, NextResponse } from "next/server";

interface CloudinaryUploadResponse {
  secure_url?: string;
  public_id?: string;
  bytes?: number;
  error?: {
    message?: string;
  };
}

export async function POST(req: NextRequest) {
  try {
    const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName || !uploadPreset) {
      return NextResponse.json(
        { error: "Missing Cloudinary cloud name or upload preset" },
        { status: 500 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");
    const folder = (formData.get("folder") as string | null) || "melon";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const cloudinaryForm = new FormData();
    cloudinaryForm.append("file", file);
    cloudinaryForm.append("folder", folder);
    cloudinaryForm.append("upload_preset", uploadPreset);

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
      {
        method: "POST",
        body: cloudinaryForm,
      }
    );

    const result = (await response.json()) as CloudinaryUploadResponse;
    if (!response.ok || result.error) {
      return NextResponse.json(
        { error: result.error?.message ?? "Cloudinary upload failed" },
        { status: response.status || 500 }
      );
    }

    return NextResponse.json({
      url: result.secure_url,
      publicId: result.public_id,
      bytes: result.bytes,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
