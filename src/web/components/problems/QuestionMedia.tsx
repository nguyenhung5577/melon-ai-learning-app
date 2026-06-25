"use client";

import Image from "next/image";

function isHttpImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function isInlineImageUrl(value: string) {
  return /^data:image\//i.test(value);
}

function isUsefulVisualDescription(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return false;
  return ![
    "không có hình",
    "không có ảnh",
    "không có hình ảnh",
    "chỉ có các dòng kẻ",
    "dòng kẻ để học sinh",
    "không có hình minh họa",
    "no image",
    "no visual",
  ].some((phrase) => normalized.includes(phrase));
}

export function QuestionMedia({
  imageUrls,
  visualDescription,
}: {
  imageUrls?: string[];
  visualDescription?: string;
}) {
  const urls = (imageUrls ?? []).map((url) => url.trim()).filter(Boolean);
  const displayableUrls = urls.filter((url) => isHttpImageUrl(url) || isInlineImageUrl(url));
  const usefulVisualDescription = visualDescription && isUsefulVisualDescription(visualDescription)
    ? visualDescription.trim()
    : "";

  if (!usefulVisualDescription && displayableUrls.length === 0) return null;

  return (
    <div className="mt-3 flex flex-col gap-3">
      {usefulVisualDescription ? (
        <p className="text-sm font-semibold text-[#555]">{usefulVisualDescription}</p>
      ) : null}

      {displayableUrls.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {displayableUrls.map((url, index) => (
            <div key={`${url}-${index}`} className="overflow-hidden rounded-xl border-2 border-[#ddd] bg-white">
              <Image
                src={url}
                alt={`Hình câu hỏi ${index + 1}`}
                width={900}
                height={450}
                sizes="(min-width: 768px) 720px, 100vw"
                unoptimized={isInlineImageUrl(url)}
                className="h-auto max-h-[32rem] w-full object-contain p-2"
              />
            </div>
          ))}
        </div>
      ) : null}

    </div>
  );
}
