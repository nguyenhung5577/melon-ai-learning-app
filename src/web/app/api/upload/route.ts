import { NextRequest, NextResponse } from "next/server";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
  api_key: process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;
    const folder = formData.get("folder") as string || "melon";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const bytes = Buffer.from(buffer);

    // Detect if file is PDF to use 'raw' resource type (fixes 404 for docs in some Cloudinary setups)
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    const resourceType = isPdf ? "raw" : "auto";

    return new Promise<NextResponse>((resolve) => {
      cloudinary.uploader.upload_stream(
        { 
          folder, 
          resource_type: resourceType,
          // For raw files, Cloudinary doesn't always add the extension to public_id, 
          // but keeping the original filename can help.
          use_filename: true,
          unique_filename: true
        },
        (error, result) => {
          if (error) {
            resolve(NextResponse.json({ error: error.message }, { status: 500 }));
          } else {
            resolve(NextResponse.json({
              url: result?.secure_url,
              publicId: result?.public_id,
            }));
          }
        }
      ).end(bytes);
    });
  } catch (error: any) {
    console.error("Upload error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
