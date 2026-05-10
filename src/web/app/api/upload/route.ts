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

    // Use 'auto' instead of forcing 'raw' for PDFs. 
    // Cloudinary detects PDFs as 'image' which enables previews and format detection.
    const resourceType = "auto";

    return new Promise<NextResponse>((resolve) => {
      cloudinary.uploader.upload_stream(
        { 
          folder, 
          resource_type: resourceType,
          use_filename: true,
          unique_filename: true,
          // If it's a PDF, we can specify the format to ensure it's recognized
          format: file.name.toLowerCase().endsWith(".pdf") ? "pdf" : undefined
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
