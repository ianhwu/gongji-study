import { getChatGPTUser } from "../../chatgpt-auth";
import { getRawDb } from "../../../db";
import learning from "../../../src/learning.json";
import history from "../../../src/question-history.json";

export const dynamic = "force-dynamic";

type Attempt = {
  count: number;
  wrong: number;
  streak: number;
  lastCorrect: boolean;
  lastChoice?: number | number[];
  lastQuestionRevision?: string;
  lastChoiceText?: string[];
  lastAt: number;
  due: number;
};
type StudyState = {
  planDay: number;
  learned: Record<string, boolean>;
  attempts: Record<string, Attempt>;
  reading?: Record<string, { page: number; lastAt: number }>;
  deviceCursors?: Record<string, number>;
  receipts?: Record<string, { fingerprint: string; correct?: boolean }>;
};
type Row = { state_json: string; revision: number };

type Question = { id: string; options: string[]; answer: number; answers?: number[]; revision?: string };
const questions = new Map<string, Question>(learning.questions.map((question) => [question.id, question]));
const legacyQuestions = new Map<string, Question>(history.map(question => [question.id, question]));
const questionVersions = new Map<string, Question>(history.map(question => [JSON.stringify([question.id, question.revision || ""]), question]));
type Chapter = { id: string; start: number; end: number };
const curriculum = [...learning.curriculum, ...learning.books] as Chapter[];
const modules = new Set([...learning.modules.map((module) => module.id), ...curriculum.map((chapter) => chapter.id), ...learning.knowledge.map((point) => point.id)]);
const chapters = new Map(curriculum.map((chapter) => [chapter.id, chapter]));
const emptyState = (): StudyState => ({ planDay: 1, learned: {}, attempts: {} });
const noStore = { "Cache-Control": "no-store" };

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: noStore });
}

function stateFromRow(row: Row | null): StudyState {
  if (!row) return emptyState();
  try { return JSON.parse(row.state_json) as StudyState; }
  catch { throw new Error("Stored progress is invalid"); }
}

function cleanImportedState(value: unknown): StudyState {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const state = emptyState();
  const day = Number(input.planDay);
  if (Number.isInteger(day)) state.planDay = Math.max(1, Math.min(29, day));
  if (input.learned && typeof input.learned === "object") {
    for (const [id, learned] of Object.entries(input.learned)) if (modules.has(id) && learned === true) state.learned[id] = true;
  }
  if (input.attempts && typeof input.attempts === "object") {
    const now = Date.now();
    for (const [id, raw] of Object.entries(input.attempts)) {
      if ((!questions.has(id) && !legacyQuestions.has(id)) || !raw || typeof raw !== "object") continue;
      const item = raw as Record<string, unknown>;
      const count = Math.max(0, Math.min(100000, Math.trunc(Number(item.count) || 0)));
      const wrong = Math.max(0, Math.min(count, Math.trunc(Number(item.wrong) || 0)));
      if (!count) continue;
      const lastAt = Math.max(0, Math.min(now + 86400000, Number(item.lastAt) || 0));
      state.attempts[id] = {
        count, wrong,
        streak: Math.max(0, Math.min(100000, Math.trunc(Number(item.streak) || 0))),
        lastCorrect: item.lastCorrect === true,
        lastQuestionRevision: typeof item.lastQuestionRevision === "string" ? item.lastQuestionRevision : undefined,
        lastChoiceText: Array.isArray(item.lastChoiceText) ? item.lastChoiceText.filter(v=>typeof v==="string").slice(0,4) as string[] : undefined,
        lastAt,
        due: Math.max(0, Math.min(now + 365 * 86400000, Number(item.due) || 0)),
      };
    }
  }
  return state;
}

function applyAction(state: StudyState, action: Record<string, unknown>) {
  let correct: boolean | undefined;
  const mutationId = typeof action.mutationId === "string" ? action.mutationId : "";
  if (mutationId && !/^[a-zA-Z0-9-]{16,80}$/.test(mutationId)) throw new Error("Invalid mutation ID");
  const fingerprint = JSON.stringify([action.type, action.questionId, action.choice, action.moduleId, action.chapterId, action.page, action.actions, action.deviceId, action.sequence, ...(action.questionRevision === undefined ? [] : [action.questionRevision])]);
  if (mutationId && state.receipts?.[mutationId]) {
    const receipt = state.receipts[mutationId];
    if (receipt.fingerprint !== fingerprint) throw new Error("Mutation already used");
    return { state, correct: receipt.correct };
  }
  switch (action.type) {
    case "answers": {
      if (!Array.isArray(action.actions) || action.actions.length < 1 || action.actions.length > 20) throw new Error("Invalid answer batch");
      for (const item of action.actions) {
        if (!item || typeof item !== "object" || item.type !== "answer" || typeof item.mutationId !== "string") throw new Error("Invalid answer batch item");
        applyAction(state, item as Record<string, unknown>);
      }
      break;
    }
    case "learn": {
      const id = String(action.moduleId || "");
      if (!modules.has(id)) throw new Error("Invalid module");
      state.learned[id] = true;
      break;
    }
    case "read": {
      const id = String(action.chapterId || "");
      const chapter = chapters.get(id), page = Number(action.page);
      if (!chapter || !Number.isInteger(page) || page < chapter.start || page > chapter.end) throw new Error("Invalid chapter page");
      state.reading ??= {};
      state.reading[id] = { page, lastAt: Date.now() };
      break;
    }
    case "advance":
      state.planDay = Math.min(29, Math.max(1, state.planDay) + 1);
      break;
    case "answer": {
      const id = String(action.questionId || "");
      const currentQuestion = questions.get(id);
      const requestedRevision = action.questionRevision;
      if (requestedRevision !== undefined && typeof requestedRevision !== "string") throw new Error("Question revised");
      const question = requestedRevision === undefined
        ? (legacyQuestions.get(id) ?? currentQuestion)
        : currentQuestion && requestedRevision === (currentQuestion.revision || "")
          ? currentQuestion
          : questionVersions.get(JSON.stringify([id, requestedRevision]));
      if (requestedRevision !== undefined && !question) throw new Error("Question revised");
      if (!question) throw new Error("Invalid answer");
      const rawChoice = action.choice;
      const choices = question.answers ? rawChoice : [rawChoice];
      if (!Array.isArray(choices) || !choices.length || choices.length > question.options.length ||
          choices.some(value => typeof value !== "number" || !Number.isInteger(value) || value < 0 || value >= question.options.length) ||
          new Set(choices).size !== choices.length || (!question.answers && typeof rawChoice !== "number")) throw new Error("Invalid answer");
      const expected = question.answers ?? [question.answer];
      correct = choices.length === expected.length && expected.every(index => choices.includes(index));
      if (action.deviceId !== undefined || action.sequence !== undefined) {
        if (typeof action.deviceId !== "string" || !/^[a-zA-Z0-9-]{16,80}$/.test(action.deviceId) || !Number.isSafeInteger(action.sequence) || Number(action.sequence) < 1) throw new Error("Invalid device sequence");
        state.deviceCursors ??= {};
        if (Number(action.sequence) <= (state.deviceCursors[action.deviceId] || 0)) break;
        state.deviceCursors[action.deviceId] = Number(action.sequence);
      }
      const old = state.attempts[id] || { count: 0, wrong: 0, streak: 0 };
      const questionRevision = question.revision || (legacyQuestions.has(id) ? "legacy" : "");
      const streak = correct ? (old.lastQuestionRevision === questionRevision ? old.streak : 0) + 1 : 0;
      const intervals = [0, 1, 3, 7, 14, 30];
      const now = Date.now();
      state.attempts[id] = {
        count: old.count + 1,
        wrong: old.wrong + (correct ? 0 : 1),
        lastQuestionRevision: questionRevision,
        lastChoiceText: (choices as number[]).map(index=>question.options[index]),
        streak, lastCorrect: correct, lastChoice: question.answers ? [...choices].sort((a,b)=>Number(a)-Number(b)) as number[] : rawChoice as number, lastAt: now,
        due: correct ? now + intervals[Math.min(streak, 5)] * 86400000 : now,
      };
      break;
    }
    case "import": {
      const incoming = cleanImportedState(action.state);
      state.planDay = Math.max(state.planDay, incoming.planDay);
      Object.assign(state.learned, incoming.learned);
      for (const [id, candidate] of Object.entries(incoming.attempts)) {
        const current = state.attempts[id];
        if (!current) { state.attempts[id] = candidate; continue; }
        const newer = candidate.lastAt > current.lastAt ? candidate : current;
        state.attempts[id] = { ...newer, count: Math.max(current.count, candidate.count), wrong: Math.max(current.wrong, candidate.wrong) };
      }
      break;
    }
    default:
      throw new Error("Invalid action");
  }
  if (mutationId) {
    state.receipts ??= {};
    state.receipts[mutationId] = { fingerprint, correct };
    const ids = Object.keys(state.receipts);
    for (const id of ids.slice(0, Math.max(0, ids.length - 64))) delete state.receipts[id];
  }
  return { state, correct };
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return response({ error: "Sign in required" }, 401);
  try {
    const db = getRawDb();
    const row = await db.prepare("SELECT state_json, revision FROM study_progress WHERE user_id = ?").bind(user.userId).first<Row>();
    return response({ state: stateFromRow(row), revision: row?.revision ?? 0, accountId: user.userId });
  } catch (error) {
    console.error("Unable to read study progress", error);
    return response({ error: "Progress temporarily unavailable" }, 503);
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return response({ error: "Sign in required" }, 401);
  if (request.headers.get("origin") !== new URL(request.url).origin) return response({ error: "Invalid origin" }, 403);
  if (!request.headers.get("content-type")?.startsWith("application/json")) return response({ error: "JSON required" }, 415);
  let action: Record<string, unknown>;
  try {
    const body = await request.text();
    if (body.length > 100000) return response({ error: "Request too large" }, 413);
    const parsed = JSON.parse(body);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error();
    action = parsed;
    if (typeof action.expectedAccountId === "string" && action.expectedAccountId !== user.userId) return response({ error: "Account changed; reload before saving" }, 409);
    // Validate before creating a row or trying any database writes.
    applyAction(emptyState(), action);
  } catch {
    return response({ error: "Invalid action" }, 400);
  }
  try {
    const db = getRawDb();
    await db.prepare("INSERT OR IGNORE INTO study_progress (user_id, state_json, revision, updated_at) VALUES (?, ?, 0, ?)")
      .bind(user.userId, JSON.stringify(emptyState()), Date.now()).run();
    for (let retry = 0; retry < 5; retry++) {
      const row = await db.prepare("SELECT state_json, revision FROM study_progress WHERE user_id = ?").bind(user.userId).first<Row>();
      if (!row) throw new Error("Progress row missing");
      const result = applyAction(stateFromRow(row), action);
      const updated = await db.prepare("UPDATE study_progress SET state_json = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ?")
        .bind(JSON.stringify(result.state), Date.now(), user.userId, row.revision).run();
      if (updated.meta.changes === 1) return response({ state: result.state, revision: row.revision + 1, correct: result.correct, accountId: user.userId });
    }
    return response({ error: "Concurrent update; retry" }, 409);
  } catch (error) {
    console.error("Unable to save study progress", error);
    return response({ error: "Progress temporarily unavailable" }, 503);
  }
}
