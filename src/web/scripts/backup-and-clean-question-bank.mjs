import fs from "node:fs/promises";
import path from "node:path";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const envPath = path.join(process.cwd(), ".env.local");
const now = new Date().toISOString();
const timestamp = now.replace(/[:.]/g, "-");
const BACKUP_COLLECTIONS = ["questionSets", "questions", "questionBank", "questionBankMeta"];
const VALID_TYPES = new Set(["multiple_choice", "short_answer", "essay"]);
const VALID_RUBRICS = new Set(["unclassified", "nhan_biet", "thong_hieu", "van_dung", "van_dung_cao"]);
const VALID_SUBJECTS = new Set(["math"]);
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const MANUAL_ANSWER_OVERRIDES = {
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-8": { answerText: "a) 100; b) 100; c) 1000; d) 7890" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-12": { answerText: "a) 101; b) 10101; c) 1001; d) 10001" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-13": { answerText: "25 nghìn đồng" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-14": { answerText: "9 giỏ" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-15": { answerText: "60 bút chì màu" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-16": { answerText: "10 cái bút mực" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-17": { answerText: "48 quả cam" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-18": { answerText: "Nam" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-19": { answerText: "30 em thiếu nhi" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-20": { answerText: "a) 40; b) 38" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-21": { answerText: "22 học sinh" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-22": { answerText: "21 tạ" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-23": { answerText: "35 viên bi" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-24": { answerText: "2970" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-25": { answerText: "2290 kg" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-26": { answerText: "45 tạ" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-27": { answerText: "24 lít" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-28": { answerText: "32 tuổi" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-29": { answerText: "145" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-30": { answerText: "Tổ I: 235 sản phẩm; Tổ II: 265 sản phẩm" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-31": { answerText: "Thửa ruộng thứ nhất: 2075 kg; Thửa ruộng thứ hai: 1975 kg" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-32": { answerText: "Thùng I: 21 lít; Thùng II: 9 lít" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-33": { answerText: "Gà mái: 50 con; Gà trống: 30 con" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-34": { answerText: "Thùng I: 32 lít; Thùng II: 18 lít" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-35": { answerText: "Ngăn trên: 36 quyển; Ngăn dưới: 72 quyển" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-36": { answerText: "40 cm và 60 cm" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-37": { answerText: "35 và 135" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-38": { answerText: "987 và 1987" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-39": { answerText: "10 và 90" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-40": { answerText: "a) 4000025 m2; b) 4dm2 15cm2; c) 425 dm2; d) 400m2 7dm2; e) 200 m2; f) 1km2 235m2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-41": { answerText: "63 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-42": { answerText: "40 m" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-43": { answerText: "18 cm" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-44": { answerText: "20 m" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-46": { answerText: "14/33 dm" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-47": { answerText: "67500 m2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-48": { answerText: "63 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-49": { answerText: "68 cm" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-50": { answerText: "1215 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-51": { answerText: "54 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-52": { answerText: "70 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-53": { answerText: "68 cm" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-54": { answerText: "70 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-55": { answerText: "108 m2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-57": { answerText: "a) 6 cm; b) 48 cm2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-58": { answerText: "Hình chữ nhật: 1976 m2; Hình vuông: 2025 m2" },
  "de-cuong-on-tap-giua-hk2-toan-4-nam-25-26-cau-59": { answerText: "4800 kg" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-1": { answer: "D", answerText: "6 000 000" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-2": { answer: "A", answerText: "55" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-4": { answer: "C", answerText: "102395" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-5": { answer: "A", answerText: "63m và 72m" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-6": { answer: "C", answerText: "576m2" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-7": { answer: "C", answerText: "3 tấn 52 kg" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-8": { answer: "B", answerText: "2 tháng 9" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-1": { answer: "C", answerText: "Ba mươi bảy triệu sáu trăm tám mươi hai nghìn chín trăm mười lăm" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-4": { answer: "C", answerText: "1 góc bẹt, 1 góc tù, 5 góc vuông, 2 góc nhọn" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-2": { answer: "D", answerText: "927 902" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-5": { answer: "A", answerText: "238" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-6": { answer: "C", answerText: "5070" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-7": { answer: "D", answerText: "452 phút" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-8": { answer: "A", answerText: "67" },
  "de-so-1-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640883-bai-1": { answerText: "a) 152771; b) 282112; c) 97272; d) 465 dư 16" },
  "de-so-1-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640883-bai-2": { answerText: "a) 19 624; 20 001; 29 815; 37 109; 48 725; b) 84 109; 65 008; 39 789; 27 912; 12 754" },
  "de-so-1-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640883-bai-3": { answerText: "a) 6916; b) 1532" },
  "de-so-1-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640883-bai-4": { answerText: "a) 4626; b) 5600; c) 252; d) 12150" },
  "de-so-2-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640958-bai-1": { answerText: "a) 108160; b) 21144; c) 48230; d) 1132 dư 30" },
  "de-so-2-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640958-bai-2": { answerText: "a) 82344; b) 1870" },
  "de-so-2-de-kiem-tra-hoc-ki-1-toan-lop-4-1670640958-bai-3": { answerText: "a) 358; 4560; 2464; 2050; 3132; b) 75; 4560; 915; 2367; 3132; 7815; c) 75; 4560; 915; 2050; 7815; d) 2367; 3132" },
  "de-so-2-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673429003-bai-2": { answerText: "a) 10/11; b) 9/8" },
  "de-so-2-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673429003-bai-3": { answerText: "a) 1/2; b) 7/6" },
  "de-so-2-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673429003-cau-6": { answerText: "a) S; b) Đ; c) Đ; d) S" },
  "de-so-1-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673428934-bai-1": { answerText: "a) 19/12; b) 1/5; c) 1/4; d) 7/4" },
  "de-so-1-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673428934-bai-2": { answerText: "a) 17/6; b) 22/5" },
  "de-so-1-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673428934-bai-4": { answerText: "4" },
  "de-so-2-de-kiem-tra-giua-hoc-ki-2-toan-lop-4-1673429003-bai-1": { answerText: "Từ trái sang phải: 1/4; 4/10; 2/5; 4/6" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-1-2": { answerText: "a) 154447; b) 23619" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-4-1666077168-cau-2-2": { answerText: "a) 4 góc vuông; b) 2 góc nhọn; c) 2 góc tù" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-1-2": { answerText: "a) 4 906 720; b) Ba trăm hai mươi lăm triệu không trăm linh bốn nghìn bảy trăm tám mươi chín" },
  "de-kiem-tra-giua-ki-1-toan-4-de-so-5-1666067302-cau-2-2": { answerText: "a) 797811; b) 491307; c) 115480; d) 3719 dư 2" },
  "de-so-1-de-kiem-tra-hoc-ki-2-de-thi-hoc-ki-2-toan-lop-4-1680686559-bai-1": { answerText: "a) 128162; 32809; b) 11/10; 8/11" },
  "de-so-1-de-kiem-tra-hoc-ki-2-de-thi-hoc-ki-2-toan-lop-4-1680686559-bai-2": { answerText: "a) 11/6; b) 14/15" },
  "de-so-1-de-kiem-tra-hoc-ki-2-de-thi-hoc-ki-2-toan-lop-4-1680686559-bai-4": { answerText: "a) 2; b) 5/8" },
  "de-so-2-de-kiem-tra-hoc-ki-2-de-thi-hoc-ki-2-toan-lop-4-1680686509-bai-1": { answerText: "a) 23/12; b) 7/20; c) 21/20; d) 3/5" },
  "de-so-2-de-kiem-tra-hoc-ki-2-de-thi-hoc-ki-2-toan-lop-4-1680686509-bai-2": { answerText: "a) 5/7; b) 1/6" },
  "de-so-2-de-kiem-tra-hoc-ki-2-de-thi-hoc-ki-2-toan-lop-4-1680686509-bai-4": { answerText: "7" },
  "de-thi-vao-lop-6-mon-toan-truong-thcs-nguyen-huu-tho-nam-2024-bai-2": { answerText: "a) 86400 đồng; b) 5 ly trà sữa truyền thống" },
  "de-thi-vao-lop-6-mon-toan-truong-thcs-nguyen-huu-tho-nam-2024-bai-3": { answerText: "8 + 7 + 65 + 4 + 3 + 2 + 1 = 90" },
  "de-thi-vao-lop-6-mon-toan-truong-thanh-xuan-nam-2025-cau-16": { answerText: "a) 150 cm2; 200 cm2; 750 cm2; b) 200 cm2; c) 100 cm2" },
};
const TITLE_WORDS = new Map([
  ["de", "Đề"],
  ["so", "số"],
  ["kiem", "kiểm"],
  ["tra", "tra"],
  ["giua", "giữa"],
  ["hoc", "học"],
  ["ki", "kì"],
  ["ky", "kỳ"],
  ["toan", "Toán"],
  ["lop", "lớp"],
  ["nam", "năm"],
  ["ket", "Kết"],
  ["noi", "nối"],
  ["tri", "tri"],
  ["thuc", "thức"],
  ["thi", "thi"],
  ["vao", "vào"],
  ["mon", "môn"],
  ["truong", "trường"],
  ["cau", "Cầu"],
  ["giay", "Giấy"],
  ["chuyen", "chuyên"],
  ["tran", "Trần"],
  ["dai", "Đại"],
  ["nghia", "Nghĩa"],
  ["thanh", "Thanh"],
  ["xuan", "Xuân"],
  ["thcs", "THCS"],
  ["nguyen", "Nguyễn"],
  ["huu", "Hữu"],
  ["tho", "Thọ"],
  ["khao", "khảo"],
  ["sat", "sát"],
  ["tuyen", "tuyển"],
  ["sinh", "sinh"],
  ["khong", "Khương"],
  ["hoc", "học"],
  ["mon", "Môn"],
]);

async function loadEnv() {
  try {
    const content = await fs.readFile(envPath, "utf8");
    for (const line of content.split(/\r?\n/)) {
      if (!line || line.trim().startsWith("#")) continue;
      const index = line.indexOf("=");
      if (index === -1) continue;
      const key = line.slice(0, index).trim();
      let value = line.slice(index + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  } catch {
    // Allow environment variables supplied by the shell/CI.
  }
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

function projectId() {
  return process.env.FIREBASE_ADMIN_PROJECT_ID || requiredEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID");
}

function initDb() {
  const app = getApps()[0] ?? initializeApp({
    credential: cert({
      projectId: projectId(),
      clientEmail: requiredEnv("FIREBASE_ADMIN_CLIENT_EMAIL"),
      privateKey: requiredEnv("FIREBASE_ADMIN_PRIVATE_KEY").replace(/\\n/g, "\n"),
    }),
  });
  return getFirestore(app);
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    index += 1;
  }
  return args;
}

const windows1252Bytes = {
  "€": 0x80,
  "‚": 0x82,
  "ƒ": 0x83,
  "„": 0x84,
  "…": 0x85,
  "†": 0x86,
  "‡": 0x87,
  "ˆ": 0x88,
  "‰": 0x89,
  "Š": 0x8a,
  "‹": 0x8b,
  "Œ": 0x8c,
  "Ž": 0x8e,
  "‘": 0x91,
  "’": 0x92,
  "“": 0x93,
  "”": 0x94,
  "•": 0x95,
  "–": 0x96,
  "—": 0x97,
  "˜": 0x98,
  "™": 0x99,
  "š": 0x9a,
  "›": 0x9b,
  "œ": 0x9c,
  "ž": 0x9e,
  "Ÿ": 0x9f,
};

function textValue(value) {
  return String(value ?? "");
}

function mojibakeScore(value) {
  const suspicious = value.match(/[ÃÂÄÅÆÐðÑÒÓÔÕÙÝÞáºá»à¸à¹]/g)?.length ?? 0;
  const replacement = value.match(/\uFFFD/g)?.length ?? 0;
  const vietnamese = value.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu)?.length ?? 0;
  return suspicious * 3 + replacement * 6 - vietnamese;
}

function encodeWindows1252Mojibake(value) {
  const bytes = [];
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code <= 0xff) {
      bytes.push(code);
      continue;
    }
    const mapped = windows1252Bytes[char];
    if (mapped === undefined) return null;
    bytes.push(mapped);
  }
  return new Uint8Array(bytes);
}

function repairMojibake(value) {
  const text = textValue(value);
  if (!/[ÃÂÄÅÆÐðÑÒÓÔÕÙÝÞáºá»à¸à¹]/.test(text)) return text;
  const encoded = encodeWindows1252Mojibake(text);
  if (!encoded) return text;
  try {
    const repaired = new TextDecoder("utf-8", { fatal: true }).decode(encoded);
    return mojibakeScore(repaired) < mojibakeScore(text) ? repaired : text;
  } catch {
    return text;
  }
}

function cleanText(value) {
  return repairMojibake(value)
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function searchableText(value) {
  return cleanText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d");
}

function normalizeAnswer(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(\d),(\d)/g, "$1.$2")
    .replace(/^(-?\d+)\s+(-?\d+)$/g, "$1/$2")
    .replace(/[.,;:]$/g, "");
}

function unique(values) {
  return Array.from(new Set(values.map((value) => cleanText(value)).filter(Boolean)));
}

function hasVietnameseMarks(value) {
  return /[Đđăâêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/u.test(value);
}

function normalizeQuestionSetTitle(id, title) {
  const current = cleanText(title);
  if (hasVietnameseMarks(current) && !/\b\d{10}\b/.test(current)) return current;

  const source = cleanText(id || current)
    .replace(/\.pdf$/i, "")
    .replace(/-\d{10,}$/u, "");
  const lowerSource = source.toLowerCase();

  let match = lowerSource.match(/^de-kiem-tra-(giua-)?hoc-ki-(\d+)-toan-(\d+)-ket-noi-tri-thuc-de-so-(\d+)$/u);
  if (match) {
    return `Đề kiểm tra ${match[1] ? "giữa " : ""}học kì ${match[2]} Toán ${match[3]} Kết nối tri thức - Đề số ${match[4]}`;
  }

  match = lowerSource.match(/^de-kiem-tra-giua-ki-(\d+)-toan-(\d+)-de-so-(\d+)$/u);
  if (match) {
    return `Đề kiểm tra giữa kì ${match[1]} Toán ${match[2]} - Đề số ${match[3]}`;
  }

  match = lowerSource.match(/^de-so-(\d+)-de-kiem-tra-giua-hoc-ki-(\d+)-toan-lop-(\d+)$/u);
  if (match) {
    return `Đề kiểm tra giữa học kì ${match[2]} Toán lớp ${match[3]} - Đề số ${match[1]}`;
  }

  match = lowerSource.match(/^de-so-(\d+)-de-kiem-tra-hoc-ki-(\d+)-toan-lop-(\d+)$/u);
  if (match) {
    return `Đề kiểm tra học kì ${match[2]} Toán lớp ${match[3]} - Đề số ${match[1]}`;
  }

  match = lowerSource.match(/^de-so-(\d+)-de-kiem-tra-hoc-ki-(\d+)-de-thi-hoc-ki-\d+-toan-lop-(\d+)$/u);
  if (match) {
    return `Đề kiểm tra học kì ${match[2]} Toán lớp ${match[3]} - Đề số ${match[1]}`;
  }

  match = lowerSource.match(/^de-thi-vao-lop-6-mon-toan-truong-(.+)-nam-(\d+)$/u);
  if (match) {
    const school = match[1].split("-").map((token) => TITLE_WORDS.get(token) ?? token.charAt(0).toUpperCase() + token.slice(1)).join(" ");
    return `Đề thi vào lớp 6 môn Toán Trường ${school} năm ${match[2]}`;
  }

  const tokens = source.split(/[-_\s]+/).filter(Boolean);
  if (tokens.length === 0) return current;

  const words = tokens.map((token) => {
    const lower = token.toLowerCase();
    if (/^\d+$/.test(lower)) return lower;
    return TITLE_WORDS.get(lower) ?? lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  let text = words.join(" ")
    .replace(/\bHọc Kì\b/g, "học kì")
    .replace(/\bHọc Kỳ\b/g, "học kỳ")
    .replace(/\bGiữa Học\b/g, "giữa học")
    .replace(/\bVào Lớp\b/g, "vào lớp")
    .replace(/\bMôn Toán\b/g, "môn Toán")
    .replace(/\bToán Lớp\b/g, "Toán lớp")
    .replace(/\bĐề Số\b/g, "Đề số")
    .replace(/\bKết Nối Tri Thức\b/g, "Kết nối tri thức")
    .replace(/\bTrường Cầu Giấy\b/g, "Trường Cầu Giấy")
    .replace(/\bTrường Chuyên Trần Đại Nghĩa\b/g, "Trường Chuyên Trần Đại Nghĩa")
    .replace(/\bTrường Thanh Xuân\b/g, "Trường Thanh Xuân")
    .replace(/\bTrường THCS Nguyễn Hữu Thọ\b/g, "Trường THCS Nguyễn Hữu Thọ");

  text = text.replace(/\bDe\b/g, "Đề");
  return text;
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function inferConcepts(question) {
  const explicit = unique(question.concepts ?? []);
  if (explicit.length > 0) return explicit;

  const text = searchableText([
    question.stem,
    question.answerText,
    question.visualDescription,
    question.rawText,
    asArray(question.choices).map((choice) => choice.text).join(" "),
  ].join(" "));
  const concepts = new Set();

  if (/phan so|\d+\s*\/\s*\d+|tu so|mau so|quy dong/.test(text)) concepts.add("fractions");
  if (/so thap phan|phan tram|chu so|dat tinh|phep tinh|\d+\s*[+\-x×*:]\s*\d+/.test(text)) concepts.add("arithmetic");
  if (/chu vi|dien tich|the tich|hinh chu nhat|hinh vuong|hinh tam giac|hinh hop|hinh lap phuong/.test(text)) concepts.add("geometry");
  if (/bai toan|loi van|hoi |con lai|tat ca|mua|ban|nhieu hon|it hon/.test(text)) concepts.add("word_problems");
  if (/logic|suy luan|chien thuat|nen lam gi/.test(text)) concepts.add("logic");

  return Array.from(concepts);
}

function shouldTreatSpacePairAsFraction(numerator, denominator) {
  const top = Number(numerator);
  const bottom = Number(denominator);
  return (
    !/^0\d/.test(String(denominator)) &&
    String(denominator).length <= 3 &&
    Number.isInteger(top) &&
    Number.isInteger(bottom) &&
    bottom !== 0 &&
    Math.abs(top) <= 999 &&
    Math.abs(bottom) <= 100
  );
}

function fractionMarkdown(numerator, denominator) {
  return `$$\\frac{${numerator}}{${denominator}}$$`;
}

function markdownMath(value, options = {}) {
  let text = cleanText(value);
  if (!text) return "";

  text = text.replace(/(\d+)\s*\/\s*(\d+)/g, (_, numerator, denominator) => fractionMarkdown(numerator, denominator));
  text = text.replace(
    /\b(phân số|phan so|bằng|bang|được|duoc)\s+(-?\d{1,3})\s+(-?\d{1,3})(?=\b)/giu,
    (match, prefix, numerator, denominator) => (
      shouldTreatSpacePairAsFraction(numerator, denominator)
        ? `${prefix} ${fractionMarkdown(numerator, denominator)}`
        : match
    )
  );
  if (searchableText(text).includes("phan so")) {
    text = text.replace(
      /\b(-?\d{1,3})\s+(-?\d{1,3})(?=\s*(?:[;,.]|là|la|rút|rut|$))/giu,
      (match, numerator, denominator) => (
        shouldTreatSpacePairAsFraction(numerator, denominator)
          ? fractionMarkdown(numerator, denominator)
          : match
      )
    );
  }
  if (options.spacePairFraction && /^-?\d{1,3}\s+-?\d{1,3}$/.test(text)) {
    const [numerator, denominator] = text.split(/\s+/);
    if (shouldTreatSpacePairAsFraction(numerator, denominator)) {
      text = fractionMarkdown(numerator, denominator);
    }
  }
  text = text.replace(/(\d+)\s*\^\s*(\d+)/g, (_, base, exponent) => `$$${base}^{${exponent}}$$`);
  text = text.replace(/\bkm2\b/gi, "km²");
  text = text.replace(/\bm2\b/gi, "m²");
  text = text.replace(/\bdm2\b/gi, "dm²");
  text = text.replace(/\bcm2\b/gi, "cm²");
  text = text.replace(/\bmm2\b/gi, "mm²");
  text = text.replace(/\bm3\b/gi, "m³");
  text = text.replace(/\bcm3\b/gi, "cm³");
  text = text.replace(/≤/g, "$$\\le$$");
  text = text.replace(/≥/g, "$$\\ge$$");

  return text;
}

function choiceKey(value, index) {
  const raw = cleanText(value).toUpperCase();
  if (/^[A-Z]$/.test(raw)) return raw;
  return LETTERS[index] ?? String(index + 1);
}

function normalizeChoices(value) {
  const choices = asArray(value)
    .map((choice, index) => ({
      key: choiceKey(choice?.key, index),
      text: cleanText(choice?.text ?? choice?.label ?? ""),
    }))
    .filter((choice) => choice.text);

  const seen = new Set();
  return choices.filter((choice) => {
    const key = `${choice.key}:${normalizeAnswer(choice.text)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).map((choice) => ({
    ...choice,
    textMarkdown: markdownMath(choice.text, { spacePairFraction: true }),
  }));
}

function parseAnswerFromExplanation(value) {
  const text = cleanText(value);
  if (!text) return "";

  const letterMatch = text.match(/(?:đáp án|chon|chọn|khoanh|answer)\s*[:\-]?\s*([A-F])\b/iu);
  if (letterMatch) return letterMatch[1].toUpperCase();

  const finalPhrasePattern = /(?:tức là|vậy|đáp số|đáp án|trả lời|kết quả)[^0-9A-F-]*(-?\d+(?:[,.]\d+)?(?:\s*\/\s*\d+)?)/giu;
  const candidates = Array.from(text.matchAll(finalPhrasePattern)).map((match) => match[1]);
  return cleanText(candidates.at(-1));
}

function formatNumberAnswer(value) {
  if (!Number.isFinite(value)) return "";
  if (Math.abs(value - Math.round(value)) < 1e-9) return String(Math.round(value));
  return String(Number(value.toFixed(8))).replace(".", ",");
}

function tokenizeExpression(value) {
  const tokens = [];
  let index = 0;
  while (index < value.length) {
    const char = value[index];
    if (/[+\-*/()]/.test(char)) {
      tokens.push(char);
      index += 1;
      continue;
    }

    const numberMatch = value.slice(index).match(/^\d+(?:\.\d+)?/);
    if (!numberMatch) return null;
    tokens.push(numberMatch[0]);
    index += numberMatch[0].length;
  }
  return tokens;
}

function evaluateTokens(tokens) {
  let index = 0;

  function parseFactor() {
    const token = tokens[index];
    if (token === undefined) return null;
    if (token === "-") {
      index += 1;
      const value = parseFactor();
      return value === null ? null : -value;
    }
    if (token === "(") {
      index += 1;
      const value = parseExpression();
      if (tokens[index] !== ")") return null;
      index += 1;
      return value;
    }
    if (/^\d+(?:\.\d+)?$/.test(token)) {
      index += 1;
      return Number(token);
    }
    return null;
  }

  function parseTerm() {
    let value = parseFactor();
    if (value === null) return null;
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index];
      index += 1;
      const right = parseFactor();
      if (right === null) return null;
      if (operator === "/" && Math.abs(right) < 1e-12) return null;
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }

  function parseExpression() {
    let value = parseTerm();
    if (value === null) return null;
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index];
      index += 1;
      const right = parseTerm();
      if (right === null) return null;
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }

  const result = parseExpression();
  return result !== null && index === tokens.length ? result : null;
}

function evaluateArithmeticExpression(value) {
  let text = cleanText(value);
  if (!/(?:\d\s*[+\-–−×*:]\s*\d|\d\s+x\s+\d)/i.test(text)) return "";

  text = text
    .replace(/^(?:câu|cau|bài|bai)\s*\d+[\).:\s-]*/iu, "")
    .replace(/^[^0-9(-]*/u, "")
    .replace(/=.*$/u, "")
    .replace(/[?!.;,]+$/u, "")
    .replace(/[–−]/g, "-")
    .replace(/(\d)\s*[×]\s*(?=\d)/g, "$1*")
    .replace(/(\d)\s+x\s+(?=\d)/gi, "$1*")
    .replace(/:/g, "/")
    .replace(/(\d)\s+(?=\d)/g, "$1")
    .replace(/,/g, ".");

  const expression = text.match(/[-+*/().\d\s]+/g)?.join("") ?? "";
  const compact = expression.replace(/\s+/g, "");
  if (!compact || !/[+\-*/]/.test(compact) || /[^-+*/().\d]/.test(compact)) return "";
  if (/[/]{2,}|[*]{2,}|[+\-*/]$/.test(compact)) return "";

  const tokens = tokenizeExpression(compact);
  if (!tokens || tokens.length < 3) return "";

  return formatNumberAnswer(evaluateTokens(tokens));
}

function splitLabeledParts(value) {
  const text = cleanText(value);
  const matches = Array.from(text.matchAll(/([a-fA-F])\)\s*/g));
  if (matches.length < 2) return [];

  return matches.map((match, index) => {
    const start = (match.index ?? 0) + match[0].length;
    const end = matches[index + 1]?.index ?? text.length;
    return {
      label: match[1].toLowerCase(),
      text: text.slice(start, end).trim().replace(/[.;,]\s*$/u, ""),
    };
  }).filter((part) => part.text);
}

function parseCompoundArithmeticAnswer(question) {
  const parts = splitLabeledParts(question.stem || question.rawText);
  if (parts.length < 2) return "";

  const answers = [];
  for (const part of parts) {
    const answer = evaluateArithmeticExpression(part.text);
    if (!answer) return "";
    answers.push(`${part.label}) ${answer}`);
  }

  return answers.join("; ");
}

function parseSingleArithmeticAnswer(question) {
  const answer = evaluateArithmeticExpression(question.stem || question.rawText);
  if (!answer) return "";

  if (question.type === "multiple_choice") {
    const choices = normalizeChoices(question.choices);
    const choice = choices.find((item) => normalizeAnswer(item.text) === normalizeAnswer(answer));
    return choice?.key ?? "";
  }

  return answer;
}

function aggregateAnsweredSubQuestions(subQuestions) {
  const parts = asArray(subQuestions)
    .map((item) => ({
      label: cleanText(item?.label).toLowerCase(),
      answerText: cleanText(item?.answerText),
    }))
    .filter((item) => item.answerText);
  if (parts.length === 0) return "";
  if (parts.length === 1 && !parts[0].label) return parts[0].answerText;
  return parts.map((item) => (item.label ? `${item.label}) ${item.answerText}` : item.answerText)).join("; ");
}

function applyManualAnswerOverride(question, changes) {
  const override = MANUAL_ANSWER_OVERRIDES[question.id];
  if (!override) return question;

  const next = { ...question };
  if (cleanText(override.answer) && cleanText(next.answer) !== cleanText(override.answer)) {
    next.answer = cleanText(override.answer);
    changes.push("filled_answer_manual_override");
  }
  if (cleanText(override.answerText) && cleanText(next.answerText) !== cleanText(override.answerText)) {
    next.answerText = cleanText(override.answerText);
    changes.push("filled_answer_text_manual_override");
  }
  return next;
}

function fillMissingAnswer(question, changes) {
  let answer = cleanText(question.answer);
  let answerText = cleanText(question.answerText);
  const choices = normalizeChoices(question.choices);
  const aggregatedSubAnswers = aggregateAnsweredSubQuestions(question.subQuestions);

  if (!answerText && aggregatedSubAnswers) {
    answerText = aggregatedSubAnswers;
    changes.push("filled_answer_text_from_subquestions");
  }

  if (question.type === "multiple_choice") {
    const keyFromAnswerText = choices.find((choice) => normalizeAnswer(choice.text) === normalizeAnswer(answerText));
    const parsed =
      parseAnswerFromExplanation(question.explanation || question.rawText) ||
      parseSingleArithmeticAnswer({ ...question, type: "multiple_choice" });
    const keyFromParsed = choices.find((choice) => normalizeAnswer(choice.key) === normalizeAnswer(parsed));

    if (!answer && keyFromAnswerText) {
      answer = keyFromAnswerText.key;
      changes.push("filled_answer_key_from_answer_text");
    }
    if (!answer && keyFromParsed) {
      answer = keyFromParsed.key;
      changes.push("filled_answer_key_inferred");
    }

    const answerChoice = choices.find((choice) => normalizeAnswer(choice.key) === normalizeAnswer(answer));
    if (!answerText && answerChoice) {
      answerText = answerChoice.text;
      changes.push("filled_answer_text_from_choice");
    }
    if (answerChoice && answer !== answerChoice.key) {
      answer = answerChoice.key;
      changes.push("normalized_answer_key");
    }
  } else {
    const parsed =
      parseAnswerFromExplanation(question.explanation || question.rawText) ||
      parseCompoundArithmeticAnswer(question) ||
      parseSingleArithmeticAnswer(question);
    if (!answerText && parsed) {
      answerText = parsed;
      changes.push("filled_answer_text_inferred");
    }
    if (!answer && answerText) {
      answer = answerText;
      changes.push("filled_answer_from_answer_text");
    }
  }

  return { answer, answerText };
}

function normalizeQuestion(doc, questionSetTitles = new Map()) {
  const changes = [];
  const id = cleanText(doc.id);
  const questionSetId = cleanText(doc.questionSetId || doc.sourceSetId);
  const sourceSetId = cleanText(doc.sourceSetId || doc.questionSetId);
  const canonicalSourceTitle = questionSetTitles.get(sourceSetId) ?? questionSetTitles.get(questionSetId);
  const choices = normalizeChoices(doc.choices);
  const type = VALID_TYPES.has(cleanText(doc.type)) ? cleanText(doc.type) : choices.length >= 2 ? "multiple_choice" : "short_answer";
  if (type !== doc.type) changes.push("normalized_type");

  const base = {
    ...doc,
    id,
    questionSetId,
    sourceSetId,
    sourceTitle: canonicalSourceTitle || normalizeQuestionSetTitle(sourceSetId || questionSetId, doc.sourceTitle),
    sourceFiles: unique(doc.sourceFiles ?? []),
    sourcePageRange: cleanText(doc.sourcePageRange),
    grade: Number(doc.grade ?? 0) || 4,
    subject: VALID_SUBJECTS.has(cleanText(doc.subject)) ? cleanText(doc.subject) : "math",
    section: cleanText(doc.section),
    questionNumber: Number(doc.questionNumber ?? 0) || 0,
    type,
    stem: cleanText(doc.stem || doc.rawText),
    choices,
    subQuestions: asArray(doc.subQuestions).map((item) => ({
      label: cleanText(item?.label),
      stem: cleanText(item?.stem),
      stemMarkdown: markdownMath(item?.stem),
      answerText: cleanText(item?.answerText),
      answerTextMarkdown: markdownMath(item?.answerText),
      explanation: cleanText(item?.explanation),
    })).filter((item) => item.stem),
    explanation: cleanText(doc.explanation),
    imageUrls: unique(doc.imageUrls ?? []),
    visualDescription: cleanText(doc.visualDescription),
    rawText: cleanText(doc.rawText || doc.stem),
    confidence: Number.isFinite(Number(doc.confidence)) ? Number(doc.confidence) : 0,
    rubricLevel: VALID_RUBRICS.has(cleanText(doc.rubricLevel)) ? cleanText(doc.rubricLevel) : "unclassified",
    answerSource: cleanText(doc.answerSource || "unknown"),
    classifiedAt: doc.classifiedAt ?? null,
    createdBy: cleanText(doc.createdBy || "unknown"),
    updatedBy: "cleanup-script",
    createdAt: doc.createdAt || now,
    updatedAt: now,
  };

  const withManualOverride = applyManualAnswerOverride({ ...base, answer: doc.answer, answerText: doc.answerText }, changes);
  const filled = fillMissingAnswer(withManualOverride, changes);
  base.answer = filled.answer;
  base.answerText = filled.answerText;
  if (base.answer || base.answerText) {
    base.answerSource = base.answerSource === "unknown"
      ? changes.some((change) => change.includes("_inferred")) ? "generated" : "provided"
      : base.answerSource;
  }
  base.concepts = inferConcepts(base);
  base.skills = unique(doc.skills ?? []);
  base.stemMarkdown = markdownMath(base.stem);
  base.answerTextMarkdown = markdownMath(base.answerText, { spacePairFraction: base.concepts.includes("fractions") });
  base.visualDescriptionMarkdown = markdownMath(base.visualDescription);
  base.rawTextMarkdown = markdownMath(base.rawText);
  base.cleanup = {
    version: 1,
    cleanedAt: now,
    changes,
    hasAnswer: Boolean(base.answer || base.answerText),
    hasMarkdown: Boolean(base.stemMarkdown || base.answerTextMarkdown),
  };

  if (cleanText(doc.stem) !== base.stem) changes.push("cleaned_stem");
  if (cleanText(doc.sourceTitle) !== base.sourceTitle) changes.push("synced_source_title");
  if (mojibakeScore(textValue(doc.stem)) > mojibakeScore(base.stem)) changes.push("repaired_mojibake");
  if (!doc.stemMarkdown || doc.stemMarkdown !== base.stemMarkdown) changes.push("updated_markdown_fields");
  if (!Array.isArray(doc.choices) || JSON.stringify(doc.choices) !== JSON.stringify(base.choices)) changes.push("normalized_choices");

  return { next: base, changes };
}

function normalizeQuestionSet(doc) {
  const title = normalizeQuestionSetTitle(doc.id, doc.title || doc.id);
  return {
    ...doc,
    id: cleanText(doc.id),
    title,
    grade: Number(doc.grade ?? 0) || 4,
    subject: VALID_SUBJECTS.has(cleanText(doc.subject)) ? cleanText(doc.subject) : "math",
    language: cleanText(doc.language || "vi"),
    sourceFiles: unique(doc.sourceFiles ?? []),
    updatedAt: now,
  };
}

async function backupCollections(db, backupDir) {
  await fs.mkdir(backupDir, { recursive: true });
  const manifest = { createdAt: now, collections: {} };

  for (const collectionName of BACKUP_COLLECTIONS) {
    const snap = await db.collection(collectionName).get();
    const docs = snap.docs.map((doc) => ({ id: doc.id, data: doc.data() }));
    await fs.writeFile(
      path.join(backupDir, `${collectionName}.json`),
      JSON.stringify(docs, null, 2),
      "utf8"
    );
    manifest.collections[collectionName] = docs.length;
  }

  await fs.writeFile(path.join(backupDir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  return manifest;
}

async function commitInBatches(db, collectionName, items) {
  let batch = db.batch();
  let count = 0;
  for (const item of items) {
    batch.set(db.collection(collectionName).doc(item.id), item.data, { merge: true });
    count += 1;
    if (count % 450 === 0) {
      await batch.commit();
      batch = db.batch();
    }
  }
  await batch.commit();
}

async function main() {
  await loadEnv();
  const args = parseArgs(process.argv.slice(2));
  const apply = Boolean(args.apply);
  const backupDir = path.resolve(String(args.backupDir || path.join(".melon-progress", "backups", `question-bank-${timestamp}`)));
  const db = initDb();

  const backup = await backupCollections(db, backupDir);
  const questionSetsSnap = await db.collection("questionSets").get();
  const questionBankSnap = await db.collection("questionBank").get();
  const setUpdates = questionSetsSnap.docs.map((doc) => ({
    id: doc.id,
    data: normalizeQuestionSet({ id: doc.id, ...doc.data() }),
  }));
  const questionSetTitles = new Map(setUpdates.map((item) => [item.id, item.data.title]));
  const questionUpdates = [];
  const report = {
    backupDir,
    apply,
    backup,
    questionSets: setUpdates.length,
    questionBank: questionBankSnap.size,
    changedQuestions: 0,
    missingAnswerBefore: 0,
    missingAnswerAfter: 0,
    changedByReason: {},
    examples: [],
  };

  for (const doc of questionBankSnap.docs) {
    const current = { id: doc.id, ...doc.data() };
    const hadAnswer = Boolean(cleanText(current.answer) || cleanText(current.answerText));
    if (!hadAnswer) report.missingAnswerBefore += 1;
    const { next, changes } = normalizeQuestion(current, questionSetTitles);
    const hasAnswer = Boolean(cleanText(next.answer) || cleanText(next.answerText));
    if (!hasAnswer) report.missingAnswerAfter += 1;
    if (changes.length === 0) continue;

    report.changedQuestions += 1;
    for (const reason of changes) {
      report.changedByReason[reason] = (report.changedByReason[reason] ?? 0) + 1;
    }
    if (report.examples.length < 10) {
      report.examples.push({
        id: doc.id,
        changes,
        before: {
          stem: current.stem,
          answer: current.answer,
          answerText: current.answerText,
        },
        after: {
          stem: next.stem,
          stemMarkdown: next.stemMarkdown,
          answer: next.answer,
          answerText: next.answerText,
        },
      });
    }
    questionUpdates.push({ id: doc.id, data: next });
  }

  if (apply) {
    await commitInBatches(db, "questionSets", setUpdates);
    await commitInBatches(db, "questionBank", questionUpdates);
  }

  console.log(JSON.stringify(report, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
