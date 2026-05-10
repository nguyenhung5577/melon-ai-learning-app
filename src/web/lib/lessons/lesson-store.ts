import { collections } from "@/lib/db/firestore";
import { getDocument, queryDocuments, setDocument } from "@/lib/db/firestore-helpers";
import { where } from "firebase/firestore";

export type LessonType = "video" | "interactive" | "quiz" | "reading";
export type Subject = "math" | "science" | "english" | "history" | "coding";

export interface LessonSlide {
  id: string;
  type: "text" | "quiz" | "drag-drop" | "fill-blank";
  title: string;
  content: string;
  options?: string[];
  answer?: string | string[];
  xp: number;
}

export interface Lesson {
  id: string;
  title: string;
  subject: Subject;
  type: LessonType;
  emoji: string;
  description: string;
  duration: number; // minutes
  xpReward: number;
  difficulty: 1 | 2 | 3; // 1=easy, 2=medium, 3=hard
  tags: string[];
  slides: LessonSlide[];
  aiEnabled: boolean;
  audioEnabled: boolean;
  thumbnailBg: string;
  cloudinaryUrl?: string; // Phase 4
  createdAt: string;
}

export const MOCK_LESSONS: Lesson[] = [
  {
    id: "lesson-001",
    title: "What is Photosynthesis?",
    subject: "science",
    type: "interactive",
    emoji: "🌿",
    description:
      "Discover how plants turn sunlight into food! Learn about chlorophyll, CO₂, water, and oxygen.",
    duration: 12,
    xpReward: 150,
    difficulty: 1,
    tags: ["biology", "plants", "energy"],
    aiEnabled: true,
    audioEnabled: true,
    thumbnailBg: "#22c55e",
    createdAt: "2026-01-10T00:00:00Z",
    slides: [
      {
        id: "s1",
        type: "text",
        title: "What is Photosynthesis?",
        content:
          "Photosynthesis is the process by which plants use sunlight, water, and carbon dioxide to make their own food. The green pigment in leaves called **chlorophyll** captures sunlight.",
        xp: 10,
      },
      {
        id: "s2",
        type: "quiz",
        title: "Quick Check",
        content: "What do plants use to capture sunlight?",
        options: ["Chlorophyll", "Glucose", "Oxygen", "Water"],
        answer: "Chlorophyll",
        xp: 30,
      },
      {
        id: "s3",
        type: "drag-drop",
        title: "The Photosynthesis Equation",
        content: "Arrange the parts of the photosynthesis equation: 6CO₂ + 6H₂O + Light → C₆H₁₂O₆ + 6O₂",
        xp: 40,
      },
      {
        id: "s4",
        type: "quiz",
        title: "Final Quiz",
        content: "What gas do plants release as a by-product of photosynthesis?",
        options: ["Carbon dioxide", "Nitrogen", "Oxygen", "Hydrogen"],
        answer: "Oxygen",
        xp: 30,
      },
    ],
  },
  {
    id: "lesson-002",
    title: "Fractions Made Easy",
    subject: "math",
    type: "interactive",
    emoji: "🍕",
    description:
      "Learn fractions with pizza! Understand numerators, denominators, and how to compare fractions.",
    duration: 15,
    xpReward: 180,
    difficulty: 2,
    tags: ["fractions", "arithmetic", "numbers"],
    aiEnabled: true,
    audioEnabled: true,
    thumbnailBg: "#ff914d",
    createdAt: "2026-01-12T00:00:00Z",
    slides: [
      {
        id: "s1",
        type: "text",
        title: "What is a Fraction?",
        content:
          "A fraction represents a **part of a whole**. It has two parts: the **numerator** (top) counts the parts you have, and the **denominator** (bottom) counts the total equal parts.",
        xp: 10,
      },
      {
        id: "s2",
        type: "quiz",
        title: "Pizza Fraction",
        content: "If a pizza has 8 slices and you eat 3, what fraction did you eat?",
        options: ["3/8", "8/3", "5/8", "1/3"],
        answer: "3/8",
        xp: 40,
      },
      {
        id: "s3",
        type: "drag-drop",
        title: "Order the Fractions",
        content: "Drag to arrange from smallest to largest: 1/4, 1/2, 3/4, 1/8",
        xp: 50,
      },
      {
        id: "s4",
        type: "quiz",
        title: "Equivalent Fractions",
        content: "Which fraction is equivalent to 1/2?",
        options: ["2/4", "2/3", "3/4", "1/3"],
        answer: "2/4",
        xp: 40,
      },
    ],
  },
  {
    id: "lesson-003",
    title: "The Water Cycle",
    subject: "science",
    type: "video",
    emoji: "💧",
    description:
      "Follow a water droplet as it evaporates, condenses, and falls as rain. Understand all four stages.",
    duration: 10,
    xpReward: 120,
    difficulty: 1,
    tags: ["weather", "water", "environment"],
    aiEnabled: true,
    audioEnabled: false,
    thumbnailBg: "#38b6ff",
    createdAt: "2026-01-15T00:00:00Z",
    slides: [
      {
        id: "s1",
        type: "text",
        title: "Evaporation",
        content:
          "The water cycle starts with **evaporation** — the sun heats water in oceans, rivers, and lakes, turning it into water vapour that rises into the air.",
        xp: 15,
      },
      {
        id: "s2",
        type: "text",
        title: "Condensation & Precipitation",
        content:
          "Water vapour rises, cools, and becomes tiny droplets forming **clouds** (condensation). When enough water collects, it falls as **precipitation** — rain, snow, or hail.",
        xp: 15,
      },
      {
        id: "s3",
        type: "quiz",
        title: "Water Cycle Stage",
        content: "What do we call the process of water turning into vapour?",
        options: ["Condensation", "Precipitation", "Evaporation", "Runoff"],
        answer: "Evaporation",
        xp: 30,
      },
    ],
  },
  {
    id: "lesson-004",
    title: "Story Writing: Beginning & End",
    subject: "english",
    type: "interactive",
    emoji: "📝",
    description:
      "Learn how to write a great story opening and a satisfying ending. Practice with AI feedback!",
    duration: 20,
    xpReward: 200,
    difficulty: 2,
    tags: ["writing", "creativity", "grammar"],
    aiEnabled: true,
    audioEnabled: true,
    thumbnailBg: "#b497ff",
    createdAt: "2026-01-18T00:00:00Z",
    slides: [
      {
        id: "s1",
        type: "text",
        title: "Hook the Reader",
        content:
          "A great story **opening** grabs the reader immediately. Start with action, a question, or a surprising fact. Avoid 'Once upon a time' — be original!",
        xp: 15,
      },
      {
        id: "s2",
        type: "quiz",
        title: "Opening Types",
        content: "Which is the strongest story opening?",
        options: [
          "Once upon a time there was a dog.",
          "The dragon's roar shook the mountain.",
          "My name is Jake and I have a dog.",
          "This story is about a dragon.",
        ],
        answer: "The dragon's roar shook the mountain.",
        xp: 35,
      },
      {
        id: "s3",
        type: "fill-blank",
        title: "Complete the Opening",
        content: "A strong opening creates _____ or raises a _____.",
        answer: ["tension", "question"],
        xp: 50,
      },
    ],
  },
  {
    id: "lesson-005",
    title: "Intro to Python: Variables",
    subject: "coding",
    type: "interactive",
    emoji: "🐍",
    description:
      "Your first step in coding! Learn what variables are and how to store data in Python.",
    duration: 18,
    xpReward: 220,
    difficulty: 2,
    tags: ["python", "programming", "variables"],
    aiEnabled: true,
    audioEnabled: false,
    thumbnailBg: "#ffde59",
    createdAt: "2026-01-20T00:00:00Z",
    slides: [
      {
        id: "s1",
        type: "text",
        title: "What is a Variable?",
        content:
          "A **variable** is like a labelled box that stores a value. In Python: `name = \"Cosmo\"` creates a variable called `name` with the value `\"Cosmo\"`.",
        xp: 15,
      },
      {
        id: "s2",
        type: "quiz",
        title: "Variable Types",
        content: "What type is the value in: `score = 100`?",
        options: ["String", "Integer", "Boolean", "Float"],
        answer: "Integer",
        xp: 40,
      },
      {
        id: "s3",
        type: "quiz",
        title: "Naming Variables",
        content: "Which is a valid Python variable name?",
        options: ["2score", "my_score", "my-score", "class"],
        answer: "my_score",
        xp: 40,
      },
    ],
  },
];

export async function seedLessons() {
  const existing = await queryDocuments(collections.lessons);
  if (existing.length === 0) {
    for (const lesson of MOCK_LESSONS) {
      await setDocument(collections.lessons, lesson.id, lesson, true);
    }
  }
}

export async function getAllLessons(): Promise<Lesson[]> {
  try {
    const docs = await queryDocuments(collections.lessons);
    // Combine Firestore lessons with MOCK_LESSONS, avoiding duplicates by ID
    const combined = [...docs];
    for (const mock of MOCK_LESSONS) {
      if (!combined.some(l => l.id === mock.id)) {
        combined.push(mock);
      }
    }
    return combined;
  } catch {
    return MOCK_LESSONS;
  }
}

export async function getLessonById(id: string): Promise<Lesson | undefined> {
  try {
    const doc = await getDocument(collections.lessons, id);
    if (doc) return doc;
    return MOCK_LESSONS.find((l) => l.id === id);
  } catch {
    return MOCK_LESSONS.find((l) => l.id === id);
  }
}

export async function getLessonsBySubject(subject: Subject): Promise<Lesson[]> {
  try {
    const docs = await queryDocuments(collections.lessons, where("subject", "==", subject));
    const combined = [...docs];
    for (const mock of MOCK_LESSONS) {
      if (mock.subject === subject && !combined.some(l => l.id === mock.id)) {
        combined.push(mock);
      }
    }
    return combined;
  } catch {
    return MOCK_LESSONS.filter((l) => l.subject === subject);
  }
}
