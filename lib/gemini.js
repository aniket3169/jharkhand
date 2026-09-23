import "server-only";
import dns from "node:dns";
try { dns.setDefaultResultOrder("ipv4first"); } catch {}

import { GoogleGenAI } from "@google/genai";
import { analyzeSchema, analysisSchema, parse, ApiError } from "./validation.js";
import { categories, universities } from "../data/seed.js";
import { ownedMedia, listProblems } from "../services/repository.js";
import { readMediaForAI } from "./storage.js";
import { calculateDistanceMeters } from "./location.js";
import { isDemoMode } from "./server-auth.js";

const question = (id, text, options) => ({ id, question: text, type: options ? "select" : "text", ...(options ? { options } : {}) });
const interview = {
  "Water Resources": [question("water_source", "What is the main source of drinking water?", ["Piped supply", "Borewell", "Handpump", "River or pond", "Other"]), question("water_pattern", "When is the water supply disrupted?", ["Continuously", "Daily", "A few days a week", "Seasonally"]), question("households", "Approximately how many households are affected?"), question("water_safety", "Have you noticed unusual colour, smell, or illness that may need a water-quality assessment?")],
  Agriculture: [question("crop", "Which crops or farming activities are most affected?"), question("irrigation", "What is the main source of irrigation?", ["Rainwater", "Borewell", "Canal", "River", "Farm pond"]), question("farmers", "Approximately how many farmers are affected?"), question("season", "Does the issue occur in a particular season?")],
  Education: [question("school", "Which school and age groups are affected?"), question("learning_barrier", "What is the biggest barrier?", ["Classrooms or facilities", "Teachers", "Digital access", "Travel to school", "Learning materials"]), question("students", "Approximately how many students are affected?"), question("education_attempts", "What has the school or community tried so far?")],
  Healthcare: [question("care", "Which health service is difficult to access?", ["Primary care", "Maternal care", "Medicines", "Emergency transport", "Specialist care"]), question("distance", "How far is the nearest functioning health facility?"), question("urgency", "Is anyone currently in immediate danger or in need of emergency medical attention?"), question("population", "Approximately how many residents are affected?")],
  Transportation: [question("route", "Which road, route, or crossing is affected?"), question("transport_risk", "What makes this route difficult or unsafe?", ["Damaged road", "No public transport", "Unsafe crossing", "Poor lighting", "Flooding"]), question("travelers", "Who uses this route most often?"), question("duration", "How long has the problem been present?")],
  "Waste Management": [question("waste_type", "What kind of waste is accumulating?", ["Household waste", "Market or organic waste", "Construction debris", "Industrial waste", "Mixed waste"]), question("collection", "How often is waste currently collected?"), question("waste_area", "How large is the affected area, and are water sources nearby?")],
  Energy: [question("energy_service", "Which electricity service is affected?", ["Household supply", "Streetlights", "Farm pumps", "School or clinic", "Other"]), question("outage", "How often, and for how long, is power unavailable?"), question("energy_attempts", "Are any backup or renewable systems currently available?")],
  Sanitation: [question("sanitation_type", "What is the main sanitation concern?", ["Drainage", "Toilets", "Wastewater", "Flooding", "Other"]), question("sanitation_season", "Does the situation become worse during rain?"), question("population", "Approximately how many residents are affected?")],
  Environment: [question("environment_type", "What environmental change have you observed?", ["Water pollution", "Air pollution", "Loss of trees", "Soil damage", "Other"]), question("environment_extent", "Where and over what area is the change visible?"), question("environment_timing", "When did you first notice it?")],
  Accessibility: [question("access_barrier", "What prevents people from accessing this place or service?", ["Steps or missing ramps", "Uneven paths", "Information barriers", "Inaccessible transport", "Other"]), question("access_users", "Which users are most affected?"), question("access_service", "Which essential service is difficult to reach?")],
  "Rural Livelihoods": [question("livelihood", "Which livelihood or craft is affected?"), question("livelihood_barrier", "What is the main constraint?", ["Market access", "Equipment", "Skills", "Working capital", "Raw materials"]), question("livelihood_people", "How many workers or households rely on this activity?")],
  "Urban Infrastructure": [question("infrastructure", "Which public infrastructure needs attention?", ["Road or footpath", "Drainage", "Public building", "Lighting", "Other"]), question("infrastructure_risk", "What safety or access problems does this cause?"), question("duration", "How long has it been in this condition?")],
  "Public Administration": [question("service", "Which public service or office is involved?"), question("service_barrier", "What makes the service difficult to use?"), question("service_attempts", "Have you already contacted the responsible office? What response did you receive?")],
  "Digital Services": [question("digital_service", "Which digital service is unavailable or difficult to use?"), question("digital_barrier", "What is the main barrier?", ["Internet connectivity", "Device access", "Language", "Usability", "Reliability"]), question("digital_users", "Who needs this service and how frequently?")],
  "Disaster Management": [question("hazard", "Which hazard is affecting the area?", ["Flooding", "Drought", "Landslide", "Extreme heat", "Other"]), question("hazard_timing", "Is this happening now, or are you reporting a recurring risk?"), question("hazard_people", "Which settlements or essential services are at risk?")],
  Other: [question("service", "Which community activity or service is being disrupted?"), question("population", "Approximately how many people are affected?"), question("duration", "When did the issue start, and what has been tried?")],
};

function inferCategory(input) {
  if (categories.includes(input.category)) return input.category;
  const text = input.description.toLowerCase();
  const rules = [["Agriculture", /farm|crop|irrigat|agricultur/], ["Water Resources", /water|pipeline|handpump|borewell|drinking/], ["Healthcare", /hospital|health|clinic|medicin|doctor/], ["Education", /school|student|teacher|classroom/], ["Waste Management", /garbage|waste|rubbish|compost/], ["Sanitation", /drain|toilet|sewage|sanitation/], ["Energy", /solar|electric|power|streetlight/], ["Transportation", /road|transport|bus|crossing|traffic/], ["Accessibility", /wheelchair|disabil|ramp|accessib/], ["Environment", /pollut|forest|tree|pond/], ["Digital Services", /internet|digital|online|network/], ["Disaster Management", /flood|drought|landslide|disaster/], ["Rural Livelihoods", /livelihood|artisan|craft|employment/]];
  return rules.find(([, pattern]) => pattern.test(text))?.[0] || "Other";
}

function demoAnalysis(input, media) {
  const category = inferCategory(input);
  let questions = [...(interview[category] || interview.Other)];
  if (category === "Water Resources" && /borewell|handpump/i.test(input.answers.water_source || "")) questions.push(question("pump_condition", "Does the pump work, or is there a mechanical or electricity problem?"));
  if (category === "Agriculture" && /rain/i.test(input.answers.irrigation || "")) questions.push(question("rain_storage", "Is there an existing pond or rainwater storage structure nearby?"));
  questions = questions.filter((item) => !Object.prototype.hasOwnProperty.call(input.answers, item.id));
  const population = Number(input.answers.population || input.answers.affectedPopulation || 0) || null;
  const urgent = /unsafe|contaminat|emergency|three weeks|no water|no reliable water|danger|accident/i.test(input.description);
  const university = universities.find((item) => item.expertise.includes(category));
  const firstSentence = input.description.split(/[.!?\n]/)[0].trim();
  const title = firstSentence.length > 110 ? firstSentence.slice(0, 107) + "…" : firstSentence;
  
  const hasIrrelevantMedia = media.some((m) => /irrelevant|selfie|meme|invalid|sample_bad|blank|placeholder|solid/i.test(m.name || ""));
  if (hasIrrelevantMedia) {
    throw new ApiError("The uploaded image does not appear to be relevant to a community or civic problem. Please upload a clear photo showing the issue.", 400);
  }

  const imageDesc = media.length ? `Photo evidence shows the condition of ${category.toLowerCase()} reported in ${input.district || "Jharkhand"}.` : "";

  return {
    title: title.length >= 5 ? title : `${category} challenge in ${input.district || "Jharkhand"}`,
    summary: input.description.slice(0, 1900),
    description: input.description,
    category,
    subcategory: "Community-reported issue",
    priority: urgent ? "High" : "Medium",
    severity: urgent ? "High" : "Medium",
    affectedPopulation: population,
    suggestedDepartments: [category === "Water Resources" ? "Drinking Water & Sanitation" : category === "Agriculture" ? "Agriculture Department" : "District Administration"],
    suggestedExpertise: university?.expertise.slice(0, 3) || [category, "Community Development"],
    suggestedDisciplines: university?.departments.slice(0, 3) || ["Social Sciences"],
    solutionDomains: ["Community assessment", "Locally maintainable interventions"],
    contributingFactors: [],
    followUpQuestions: questions.slice(0, 4),
    observations: ["This is a structured summary of the citizen's description; conditions have not been independently verified."],
    missingInformation: questions.map((item) => item.question).slice(0, 6),
    evidenceSummary: media.length ? `${media.length} evidence file(s) attached.` : "No media supplied. Evidence can be added before submission.",
    imageDescription: imageDesc,
    isRelevant: true,
    relevanceReason: ""
  };
}

async function geminiAnalysis(input, media) {
  const client = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: { timeout: 45000 }
  });

  const parts = [];
  let budget = 12 * 1024 * 1024;
  const analyzed = [];
  for (const item of media.slice(0, 5)) {
    if (item.size > budget) continue;
    const part = await readMediaForAI(item);
    if (part) { parts.push(part); budget -= item.size; analyzed.push(item.id); }
  }

  const prompt = `You are an expert civic intelligence AI for a community challenge reporting portal in Jharkhand, India.
Your task is to analyze user-reported community problems and thoroughly understand any uploaded evidence images.

MANDATORY STEP 1: RELEVANCE VERIFICATION OF UPLOADED MEDIA
- If any image or video is attached in the user's report, inspect each one carefully.
- Determine if the media is RELEVANT to a public civic, infrastructure, environmental, water, sanitation, health, education, agricultural, road, or community problem in Jharkhand.
- An image is IRRELEVANT if:
  * It is a solid/blank color block, placeholder, or uninformative graphic.
  * It is a personal selfie, portrait, or social picture unrelated to any public issue.
  * It is a meme, cartoon, anime, video game screenshot, artwork, or wallpaper.
  * It is a photo of domestic pets, animals, celebrities, movies, or sports.
  * It is food, personal merchandise, or commercial promotional material.
  * It does NOT visually depict or show any civic issue, infrastructure damage, environmental problem, or public hazard.
- IF ANY ATTACHED IMAGE IS IRRELEVANT:
  * You MUST set "isRelevant": false.
  * You MUST set "relevanceReason" to a clear, polite error message explaining what was detected and asking for a photo of the actual civic issue (e.g., "The uploaded photo does not show a public infrastructure, environmental, or community problem. Please upload a clear photo of the actual issue.").
- IF ALL ATTACHED MEDIA ARE RELEVANT (or if no media was attached):
  * Set "isRelevant": true.
  * Set "relevanceReason": "".

MANDATORY STEP 2: IMAGE UNDERSTANDING & CONTEXTUAL QUESTION GENERATION
- When media is attached and relevant:
  * At the same time, give a thorough, vivid "imageDescription" describing what is shown in the image (the type of infrastructure, the visible damage/defects, water accumulation, gravel/mud, environment, setting, and hazards).
  * Record specific visual facts in "observations" (e.g., "Image shows severe asphalt erosion with multiple deep water-filled potholes.").
  * In "evidenceSummary", explain what the visual evidence proves regarding the reported challenge.
  * GENERATE 2 TO 4 CONTEXTUAL FOLLOW-UP QUESTIONS SPECIFICALLY GROUNDED IN WHAT IS VISIBLE IN THE IMAGE.
    Ask about details that the image highlights or questions that cannot be determined from the image alone (e.g., length of damaged road stretch, duration of water stagnation, impact on students/patients, past maintenance attempts).
- When no media is attached:
  * Set "imageDescription": "".
  * Generate 2-4 questions relevant to the text description and category.
- Do NOT repeat questions that have already been answered in USER_REPORT.answers.
- Each follow-up question MUST have:
  * id: concise snake_case string (e.g., "pothole_traffic_impact", "damaged_stretch_length")
  * question: specific, polite question string
  * type: "text" | "number" | "select"
  * options: array of 2-5 strings if type is "select" (otherwise omit or empty array)

STEP 3: CATEGORIZATION AND IMPACT
- Category must be one of: ${categories.join(", ")}.
- Priority and severity: "Low" | "Medium" | "High" | "Critical".

Return ONLY a valid JSON object with:
{
  "isRelevant": boolean,
  "relevanceReason": string,
  "imageDescription": string,
  "title": string,
  "summary": string,
  "description": string,
  "category": string,
  "subcategory": string,
  "priority": "Low"|"Medium"|"High"|"Critical",
  "severity": "Low"|"Medium"|"High"|"Critical",
  "affectedPopulation": number|null,
  "suggestedDepartments": string[],
  "suggestedExpertise": string[],
  "suggestedDisciplines": string[],
  "solutionDomains": string[],
  "contributingFactors": string[],
  "observations": string[],
  "missingInformation": string[],
  "evidenceSummary": string,
  "followUpQuestions": [
    {
      "id": string,
      "question": string,
      "type": "text"|"number"|"select",
      "options": string[]
    }
  ]
}

USER_REPORT=${JSON.stringify({ ...input, evidence: media.map((item) => ({ id: item.id, type: item.type, analyzed: analyzed.includes(item.id), location: item.location })) })}`;

  parts.unshift({ text: prompt });

  const candidateModels = [
    process.env.GEMINI_MODEL || "gemini-flash-latest",
    "gemini-3.5-flash"
  ];

  const uniqueModels = [...new Set(candidateModels.filter(Boolean))];

  let response;
  let lastError;

  for (const model of uniqueModels) {
    try {
      response = await client.models.generateContent({
        model,
        contents: parts,
        config: {
          responseMimeType: "application/json",
          temperature: 0.2,
          maxOutputTokens: 4000,
          httpOptions: { timeout: 25000 }
        }
      });
      if (response?.text) break;
    } catch (error) {
      lastError = error;
      console.warn(`Gemini model ${model} failed:`, error?.message || error);
    }
  }

  if (!response?.text) {
    console.warn("All Gemini candidate models failed, delegating to fallback:", lastError?.message || lastError);
    throw new ApiError("The AI service is temporarily unavailable. Your report is safe; try again or continue with your own summary.", 502);
  }

  try {
    const rawText = response.text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
    const parsed = parse(analysisSchema, JSON.parse(rawText));

    if (parsed.isRelevant === false) {
      throw new ApiError(
        parsed.relevanceReason || "The uploaded image does not appear to be relevant to a community or civic challenge. Please upload a clear photo of the issue.",
        400
      );
    }

    return { analysis: parsed, analyzedMediaIds: analyzed };
  } catch (err) {
    if (err instanceof ApiError) throw err;
    console.error("Gemini JSON parse/validation error:", err);
    throw new ApiError("The AI response could not be validated. Please retry or continue with your own summary.", 502);
  }
}

async function duplicateCandidates(input, category, user) {
  const tokens = new Set(input.description.toLowerCase().match(/[a-z]{4,}/g) || []);
  const existing = await listProblems(user);
  return existing.map((problem) => {
    let score = problem.category === category ? 2 : 0;
    if (input.district && problem.district === input.district) score += 2;
    const words = new Set(`${problem.title} ${problem.description}`.toLowerCase().match(/[a-z]{4,}/g) || []);
    const overlap = [...tokens].filter((word) => words.has(word)).length;
    score += Math.min(overlap / 3, 3);
    if (input.location && problem.location && calculateDistanceMeters(input.location.latitude, input.location.longitude, problem.location.latitude, problem.location.longitude) < 5000) score += 2;
    return { id: problem.id, title: problem.title, district: problem.district, status: problem.status, similarity: score >= 7 ? "High" : "Possible", score, method: "Keyword, category, and approximate location comparison; review required." };
  }).filter((item) => item.score >= 5).sort((a, b) => b.score - a.score).slice(0, 3);
}

export async function analyzeProblem(body, user) {
  const input = parse(analyzeSchema, body);
  const media = await ownedMedia(input.evidence, user);
  const useGemini = Boolean(process.env.GEMINI_API_KEY);
  if (!useGemini && !isDemoMode()) throw new ApiError("AI analysis is not configured. You can still submit your report using your own summary.", 503);
  
  let result;
  let isAiGenerated = false;

  if (useGemini) {
    try {
      result = await geminiAnalysis(input, media);
      isAiGenerated = true;
    } catch (err) {
      if (err.status === 400) throw err;
      console.warn("Gemini service unavailable, falling back to local analysis:", err?.message || err);
      result = {
        analysis: parse(analysisSchema, demoAnalysis(input, media)),
        analyzedMediaIds: []
      };
    }
  } else {
    result = {
      analysis: parse(analysisSchema, demoAnalysis(input, media)),
      analyzedMediaIds: []
    };
  }

  const analysis = {
    ...result.analysis,
    source: isAiGenerated ? "gemini" : "demo",
    aiGenerated: isAiGenerated,
    label: isAiGenerated ? "AI-generated suggestions · review before submitting" : "Local guidance · AI is temporarily unavailable",
    analyzedMediaIds: result.analyzedMediaIds,
    duplicateCandidates: await duplicateCandidates(input, result.analysis.category, user),
    generatedAt: new Date().toISOString()
  };

  const questions = (analysis.followUpQuestions || []).filter((item) => !Object.prototype.hasOwnProperty.call(input.answers, item.id));
  analysis.followUpQuestions = questions;
  return { analysis, source: analysis.source, questions, complete: questions.length === 0 };
}
