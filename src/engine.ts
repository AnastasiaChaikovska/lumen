import type { Analysis, InterviewPrep, LinkedInKit, SearchStage } from "./types";

const STOP_WORDS = new Set([
  "about",
  "above",
  "across",
  "after",
  "again",
  "against",
  "also",
  "and",
  "any",
  "applicant",
  "are",
  "based",
  "been",
  "being",
  "benefits",
  "but",
  "can",
  "candidate",
  "company",
  "could",
  "day",
  "days",
  "desirable",
  "duties",
  "each",
  "essential",
  "etc",
  "experience",
  "for",
  "from",
  "has",
  "have",
  "having",
  "here",
  "into",
  "job",
  "looking",
  "must",
  "our",
  "out",
  "per",
  "please",
  "plus",
  "preferred",
  "requirements",
  "responsibilities",
  "role",
  "salary",
  "should",
  "successful",
  "that",
  "the",
  "their",
  "they",
  "this",
  "to",
  "through",
  "under",
  "using",
  "we",
  "will",
  "with",
  "within",
  "work",
  "working",
  "would",
  "you",
  "your"
]);

const HIGH_SIGNAL_TERMS = new Set([
  "accounting",
  "administration",
  "agile",
  "analytics",
  "api",
  "budgeting",
  "campaigns",
  "compliance",
  "crm",
  "css",
  "customer",
  "data",
  "excel",
  "finance",
  "forecasting",
  "html",
  "javascript",
  "kpi",
  "leadership",
  "management",
  "marketing",
  "operations",
  "payroll",
  "powerbi",
  "python",
  "react",
  "reporting",
  "risk",
  "sales",
  "seo",
  "sql",
  "stakeholder",
  "strategy",
  "support",
  "typescript",
  "user",
  "ux"
]);

const SECTION_PATTERNS = {
  contact: /@|linkedin\.com/i,
  summary: /\b(summary|profile|objective|personal statement)\b/i,
  experience: /\b(experience|employment|career history|work history|projects)\b/i,
  skills: /\b(skills|technical skills|core skills|competencies|tools)\b/i,
  education: /\b(education|qualifications|certifications|training)\b/i
};

const ACTION_VERBS = [
  "Delivered",
  "Managed",
  "Improved",
  "Coordinated",
  "Analysed",
  "Supported",
  "Built",
  "Led"
];

function cleanWord(word: string) {
  return word
    .toLowerCase()
    .replace(/^[^a-z0-9+#.]+|[^a-z0-9+#.]+$/g, "")
    .replace(/\.+$/g, "");
}

function normaliseWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/\t/g, " ").replace(/[ ]{2,}/g, " ").trim();
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function isContactLine(line: string) {
  if (/@|linkedin\.com/i.test(line)) return true;
  const digits = line.replace(/\D/g, "");
  const looksLikeDateRange = /\b(19|20)\d{2}\s*[-–]\s*(present|current|(19|20)?\d{2})\b/i.test(line);
  return digits.length >= 9 && !looksLikeDateRange;
}

function sentenceCase(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;
  return trimmed[0].toUpperCase() + trimmed.slice(1);
}

function formatTerm(term: string) {
  if (term === "api" || term === "b2b" || term === "crm" || term === "css" || term === "html" || term === "kpi" || term === "kpis" || term === "seo" || term === "sql" || term === "ux") {
    return term.toUpperCase();
  }

  if (term === "powerbi") {
    return "Power BI";
  }

  return term
    .split(/[ -]/)
    .map((part) => sentenceCase(part))
    .join(" ");
}

function textWords(text: string) {
  return normaliseWhitespace(text)
    .toLowerCase()
    .match(/[a-z][a-z0-9+#.]{2,}/g) ?? [];
}

function keywordScores(text: string) {
  const scores = new Map<string, number>();

  textWords(text).forEach((rawWord) => {
    const word = cleanWord(rawWord);
    if (!word || STOP_WORDS.has(word) || word.length < 3) return;
    const bonus = HIGH_SIGNAL_TERMS.has(word) ? 4 : 1;
    scores.set(word, (scores.get(word) ?? 0) + bonus);
  });

  const phraseMatches = normaliseWhitespace(text)
    .toLowerCase()
    .match(/\b[a-z][a-z0-9+#.]+(?:\s+[a-z][a-z0-9+#.]+){1,2}\b/g) ?? [];

  phraseMatches.forEach((phrase) => {
    const parts = phrase.split(/\s+/).map(cleanWord);
    if (parts.some((part) => STOP_WORDS.has(part)) || parts.join("").length < 9) return;
    if (!parts.some((part) => HIGH_SIGNAL_TERMS.has(part))) return;
    const cleanPhrase = parts.join(" ");
    scores.set(cleanPhrase, (scores.get(cleanPhrase) ?? 0) + 2);
  });

  return scores;
}

export function extractKeywords(text: string, limit = 24) {
  return Array.from(keywordScores(text).entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([term]) => term);
}

function hasAnySection(text: string, pattern: RegExp) {
  return pattern.test(text);
}

function hasContact(text: string) {
  return text
    .split("\n")
    .some((line) => isContactLine(line.trim()));
}

function countBullets(text: string) {
  return (text.match(/^\s*[-•*]/gm) ?? []).length;
}

function countMetrics(text: string) {
  return (text.match(/(\d+%|£\s?\d+|\b\d+\+?\b|kpi|revenue|budget|saved|reduced|increased|improved)/gi) ?? []).length;
}

function clampScore(score: number) {
  return Math.max(12, Math.min(96, Math.round(score)));
}

export function analyseApplication(cvText: string, jobText: string, targetRole: string): Analysis {
  const cv = normaliseWhitespace(cvText);
  const job = normaliseWhitespace(jobText || targetRole);
  const jobKeywordSource = job.replace(
    /^\s*(company|employer|organisation|organization)\s*[:\-].*$/gim,
    ""
  );
  const cvLower = cv.toLowerCase();
  const targetWords = new Set(textWords(targetRole).map(cleanWord));
  const jobKeywords = extractKeywords(jobKeywordSource, jobText ? 26 : 12).filter(
    (keyword) => HIGH_SIGNAL_TERMS.has(keyword) || !targetWords.has(keyword)
  );

  if (textWords(cv).length < 20) {
    const roleKeywords = jobKeywords.length
      ? jobKeywords.slice(0, 10).map(formatTerm)
      : extractKeywords(targetRole, 8).map(formatTerm);
    const topIssues = [
      "Add your CV when it is nearby to sharpen this plan around your real experience.",
      "Start with a plain one-column CV structure: profile, core skills, experience, education and ATS-safe contact details.",
      jobText
        ? "Use the job advert keywords only where they are true for you."
        : "Paste a specific job advert later to tailor the keywords for each application."
    ];

    return {
      score: 41,
      matchedKeywords: [],
      keywordGaps: roleKeywords,
      topIssues,
      allIssues: [
        ...topIssues,
        "Add measurable evidence to your future bullets: volume, tools, frequency, budget, percentage change or outcomes.",
        "Keep every claim factual; do not add skills, employers or achievements you cannot support."
      ],
      formattingIssues: [
        "Use one column, plain headings and standard bullets.",
        "Avoid icons, tables, text boxes and image-only CV sections."
      ],
      sectionNotes: [
        "Profile: add a 3-4 line summary aimed at the target role.",
        "Skills: add a compact keyword-led section once you have your CV nearby.",
        "Experience: list roles in reverse chronological order with action-led bullets.",
        "Education: keep qualifications concise and easy to scan."
      ],
      improvementSteps: [
        "Add your current CV when you are ready to tailor the pack around your real roles and achievements.",
        roleKeywords.length
          ? `Gather evidence for relevant role keywords: ${roleKeywords.slice(0, 6).join(", ")}.`
          : "Gather the tools, methods and responsibilities that match the role you want.",
        "Write 5-8 bullets from recent roles using action + scope + result.",
        "Keep the CV one column with plain text contact details.",
        "Re-run with a specific job advert when you are ready to tailor an application."
      ],
      strengths: [
        targetRole
          ? `You have chosen a target direction: ${targetRole}.`
          : "You can begin with a target role before adding documents.",
        "Starting now is better than waiting for every document to be perfectly organised."
      ],
      createdAt: new Date().toISOString()
    };
  }

  const cvKeywords = new Set(extractKeywords(cv, 80));
  const matched = jobKeywords.filter((keyword) => cvLower.includes(keyword) || cvKeywords.has(keyword));
  const missing = jobKeywords.filter((keyword) => !matched.includes(keyword)).slice(0, 12);
  const keywordRatio = jobKeywords.length ? matched.length / jobKeywords.length : 0.55;

  const sectionChecks = [
    hasContact(cv),
    hasAnySection(cv, SECTION_PATTERNS.summary),
    hasAnySection(cv, SECTION_PATTERNS.experience),
    hasAnySection(cv, SECTION_PATTERNS.skills),
    hasAnySection(cv, SECTION_PATTERNS.education)
  ];
  const sectionRatio = sectionChecks.filter(Boolean).length / sectionChecks.length;

  const bulletCount = countBullets(cv);
  const metricCount = countMetrics(cv);
  const textLength = textWords(cv).length;
  const hasLongParagraphs = cv.split(/\n{2,}/).some((part) => textWords(part).length > 95);
  const hasFormattingRisk = /[|]{2,}|<table|<\/table|▣|◆|★|→|═|_{4,}/i.test(cvText);
  const formattingRatio = 1 - (hasLongParagraphs ? 0.18 : 0) - (hasFormattingRisk ? 0.22 : 0) - (textLength < 170 ? 0.2 : 0);
  const evidenceRatio = Math.min(1, (bulletCount / 8) * 0.45 + (metricCount / 5) * 0.55);
  const base = 100 * (keywordRatio * 0.44 + sectionRatio * 0.24 + formattingRatio * 0.17 + evidenceRatio * 0.15);
  const score = clampScore(base);

  const formattingIssues: string[] = [];
  if (hasFormattingRisk) {
    formattingIssues.push("Remove tables, decorative dividers, icons or multi-column styling so ATS parsers read the CV in order.");
  }
  if (hasLongParagraphs) {
    formattingIssues.push("Break dense paragraphs into short achievement bullets with clear headings.");
  }
  if (!hasContact(cv)) {
    formattingIssues.push("Add plain-text contact details near the top: email, phone and LinkedIn if available.");
  }
  if (textLength < 170) {
    formattingIssues.push("The CV looks thin for ATS matching; add relevant experience, tools, qualifications and measurable outcomes.");
  }
  if (!formattingIssues.length) {
    formattingIssues.push("Formatting is mostly ATS-safe: keep a single column, simple headings and plain bullets.");
  }

  const allIssues: string[] = [];
  if (missing.length) {
    allIssues.push(`The job description emphasises ${missing.slice(0, 5).map(formatTerm).join(", ")}, but these terms are weak or absent in the CV.`);
  }
  if (!SECTION_PATTERNS.skills.test(cv)) {
    allIssues.push("There is no clear skills section, making keyword scanning harder for both ATS tools and recruiters.");
  }
  if (!SECTION_PATTERNS.summary.test(cv)) {
    allIssues.push(`The CV needs a sharper opening profile aimed at ${targetRole || "the target role"}.`);
  }
  if (metricCount < 3) {
    allIssues.push("Too few bullets show measurable impact, such as scale, volume, percentage change, budget or turnaround time.");
  }
  if (bulletCount < 6) {
    allIssues.push("Experience is not scannable enough; use short, action-led bullets instead of blocks of text.");
  }
  if (hasFormattingRisk || hasLongParagraphs) {
    allIssues.push(formattingIssues[0]);
  }
  [
    "Move the strongest matched keywords into the profile and first skills line so they appear in the top third of the CV.",
    "Add more evidence to the most relevant bullets: scope, tools, numbers, frequency or outcome.",
    "Export a plain-text ATS version and check that headings, dates and bullets still read in the correct order."
  ].forEach((fallback) => {
    if (allIssues.length < 3 && !allIssues.includes(fallback)) {
      allIssues.push(fallback);
    }
  });
  if (!allIssues.length) {
    allIssues.push("The CV is already solid; the main lift is tailoring the summary and top skills to this specific role.");
  }

  const strengths: string[] = [];
  if (matched.length) {
    strengths.push(`Matched role keywords: ${matched.slice(0, 8).map(formatTerm).join(", ")}.`);
  }
  if (sectionRatio >= 0.8) {
    strengths.push("Core ATS sections are present and easy to identify.");
  }
  if (!hasFormattingRisk) {
    strengths.push("No obvious table or graphic-heavy formatting risk was detected.");
  }
  if (metricCount >= 3) {
    strengths.push("Several bullets already include measurable evidence.");
  }

  const sectionNotes = [
    SECTION_PATTERNS.summary.test(cv)
      ? "Profile: present. Tighten it around the target role and the strongest matching keywords."
      : "Profile: missing. Add a 3-4 line summary tailored to the role.",
    SECTION_PATTERNS.skills.test(cv)
      ? "Skills: present. Move the most job-relevant terms into the first two lines."
      : "Skills: missing. Add a compact keyword-led skills section.",
    SECTION_PATTERNS.experience.test(cv)
      ? "Experience: present. Lead each bullet with action and evidence."
      : "Experience: unclear. Use a plain heading such as Professional Experience or Work History.",
    SECTION_PATTERNS.education.test(cv)
      ? "Education: present. Keep it concise and ATS-readable."
      : "Education: unclear. Add education, qualifications or training if relevant."
  ];

  const improvementSteps = [
    missing.length
      ? `Add the missing keywords only where they are true: ${missing.slice(0, 6).map(formatTerm).join(", ")}.`
      : "Keep the strongest role keywords visible in the summary and skills section.",
    "Rewrite the opening profile so it names the target role, your relevant strengths and the setting you have worked in.",
    "Convert responsibilities into achievement bullets using action + scope + result.",
    "Keep the document one column with simple headings, plain bullets and no icons or tables.",
    "Export a plain-text ATS version and check that the reading order still makes sense."
  ];

  return {
    score,
    matchedKeywords: matched.map(formatTerm),
    keywordGaps: missing.map(formatTerm),
    topIssues: allIssues.slice(0, 3),
    allIssues,
    formattingIssues,
    sectionNotes,
    improvementSteps,
    strengths,
    createdAt: new Date().toISOString()
  };
}

function extractName(cvText: string) {
  const lines = cvText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const firstUseful = lines.find((line) => {
    if (SECTION_PATTERNS.contact.test(line)) return false;
    if (line.length > 64) return false;
    if (/^(cv|curriculum vitae|resume)$/i.test(line)) return false;
    return /[a-z]/i.test(line);
  });

  return firstUseful ?? "Your Name";
}

function extractContact(cvText: string) {
  return unique(
    cvText
      .split("\n")
      .map((line) => line.trim())
      .filter(isContactLine)
  ).slice(0, 4);
}

function isDocumentHeading(line: string) {
  return /^(professional\s+)?(profile|summary|experience|employment|work history|career history|skills|core skills|technical skills|education|qualifications|certifications|training)$/i.test(line.trim());
}

function sourceBullets(cvText: string) {
  const lines = cvText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const bulletLines = lines
    .filter((line) => /^\s*[-•*]/.test(line))
    .map((line) => line.replace(/^[•*\-]\s*/, ""))
    .filter((line) => line.length > 18 && line.length < 190);

  if (bulletLines.length >= 3) {
    return unique(bulletLines).slice(0, 14);
  }

  const rawLines = cvText
    .replace(/\r/g, "")
    .split(/\n|(?<=[.!?])\s+(?=[A-Z])/)
    .map((line) => line.trim().replace(/^[•*\-]\s*/, ""))
    .filter((line) => line.length > 22 && line.length < 190);

  const filtered = rawLines.filter((line) => {
    if (SECTION_PATTERNS.contact.test(line)) return false;
    if (isContactLine(line)) return false;
    if (isDocumentHeading(line)) return false;
    if (/\b(19|20)\d{2}\s*[-–]\s*(present|current|(19|20)?\d{2})\b/i.test(line)) return false;
    return true;
  });

  return unique(filtered).slice(0, 14);
}

function extractEducation(cvText: string) {
  const lines = cvText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const educationIndex = lines.findIndex((line) => /\b(education|qualifications|certifications|training)\b/i.test(line));

  if (educationIndex >= 0) {
    const output: string[] = [];
    for (let index = educationIndex + 1; index < lines.length; index += 1) {
      const line = lines[index];
      if (isDocumentHeading(line)) break;
      if (!isContactLine(line)) output.push(line.replace(/^[•*\-]\s*/, ""));
    }
    if (output.length) return unique(output).slice(0, 6);
  }

  return unique(
    lines.filter((line) =>
      /\b(ba|bsc|ma|msc|phd|degree|university|college|certified|certificate|qualification|gcse|a-level)\b/i.test(line)
    )
  ).slice(0, 6);
}

function extractExperienceEntries(cvText: string) {
  const lines = cvText
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const entries: Array<{ role: string; bullets: string[] }> = [];
  let inExperience = false;
  let current: { role: string; bullets: string[] } | null = null;
  const dateRange = /\b(19|20)\d{2}\s*[-–]\s*(present|current|(19|20)?\d{2})\b/i;

  lines.forEach((line) => {
    if (SECTION_PATTERNS.experience.test(line) && isDocumentHeading(line)) {
      inExperience = true;
      return;
    }

    if (inExperience && isDocumentHeading(line) && !SECTION_PATTERNS.experience.test(line)) {
      inExperience = false;
      current = null;
      return;
    }

    if (!inExperience) return;

    if (dateRange.test(line) && !/^\s*[-•*]/.test(line)) {
      current = { role: line, bullets: [] };
      entries.push(current);
      return;
    }

    if (/^\s*[-•*]/.test(line) && current) {
      current.bullets.push(line.replace(/^[•*\-]\s*/, ""));
    }
  });

  return entries.filter((entry) => entry.bullets.length);
}

function improveBullet(line: string, index: number) {
  const trimmed = sentenceCase(line.replace(/\s+/g, " ").replace(/\.$/, ""));
  const startsWithAction = /^(delivered|managed|improved|coordinated|analysed|analyzed|supported|built|led|created|developed|owned|reduced|increased|maintained|processed|handled|planned|tracked|reported|cleaned)\b/i.test(trimmed);
  return startsWithAction ? `${trimmed}.` : `${ACTION_VERBS[index % ACTION_VERBS.length]} ${trimmed.replace(/^(responsible for|worked on|helped with)\s+/i, "")}.`;
}

function stageLine(stage: SearchStage) {
  if (stage === "no-luck") return "Focused on clearer evidence, stronger keyword alignment and concise recruiter-readable communication.";
  if (stage === "while") return "Brings an organised, evidence-led approach with the most relevant strengths made visible quickly.";
  return "Presents a clear, role-focused foundation for targeted applications.";
}

export function generateOptimizedCv(
  cvText: string,
  targetRole: string,
  searchStage: SearchStage,
  analysis: Analysis
) {
  const hasCv = textWords(cvText).length >= 20;
  const name = extractName(cvText);
  const contact = extractContact(cvText);
  const bullets = sourceBullets(cvText);
  const experienceEntries = extractExperienceEntries(cvText);
  const education = extractEducation(cvText);
  const skills = unique([...analysis.matchedKeywords, ...extractKeywords(cvText, 12).map(formatTerm)]).slice(0, 12);
  const role = targetRole || "Target Role";

  if (!hasCv) {
    const starterSkills = analysis.keywordGaps.length
      ? analysis.keywordGaps.slice(0, 10).join(" | ")
      : "Add verified role keywords from your experience";

    return [
      "YOUR NAME",
      "Email | Phone | LinkedIn",
      "",
      "TARGET ROLE",
      role,
      "",
      "PROFESSIONAL SUMMARY",
      `- ${role} candidate preparing a targeted UK application.`,
      "- Add 2-3 factual strengths from your background once your CV is nearby.",
      "- Keep this section specific, plain and recruiter-readable.",
      "",
      "CORE SKILLS",
      `- ${starterSkills}`,
      "- Replace any keyword that is not true for you.",
      "",
      "PROFESSIONAL EXPERIENCE",
      "Most recent role, company, dates",
      "- Add an action-led bullet: what you did, who it helped, and what changed.",
      "- Add a measurable bullet: volume, speed, budget, percentage, frequency or quality result.",
      "- Add a collaboration bullet: teams, customers, stakeholders or tools used.",
      "",
      "Previous role, company, dates",
      "- Add 2-4 relevant bullets from earlier experience.",
      "",
      "EDUCATION, QUALIFICATIONS AND TRAINING",
      "- Add verified education, certifications and training."
    ].join("\n");
  }

  const summary = [
    `${role} candidate with experience evidenced in the original CV across ${skills.slice(0, 4).join(", ") || "relevant responsibilities"}.`,
    stageLine(searchStage)
  ];

  const experienceBullets = bullets.length
    ? bullets.map(improveBullet)
    : [
        "Add 5-8 bullets from your recent roles, each using action + scope + result.",
        "Keep every claim factual and aligned to evidence already in your CV."
      ];

  const verifiedSkills = skills.length
    ? skills.join(" | ")
    : "Add verified tools, methods, industry knowledge and transferable skills from your CV.";

  const experienceSection = experienceEntries.length
    ? experienceEntries.flatMap((entry, entryIndex) => [
        entry.role,
        ...entry.bullets.map((item, bulletIndex) => `- ${improveBullet(item, entryIndex + bulletIndex)}`),
        ""
      ])
    : experienceBullets.map((item) => `- ${item}`);

  const educationSection = education.length
    ? education.map((item) => `- ${item}`)
    : ["- Add verified education, qualifications and training from your original CV."];

  return [
    name.toUpperCase(),
    contact.length ? contact.join(" | ") : "Email | Phone | LinkedIn",
    "",
    "TARGET ROLE",
    role,
    "",
    "PROFESSIONAL SUMMARY",
    ...summary.map((item) => `- ${item}`),
    "",
    "CORE SKILLS",
    `- ${verifiedSkills}`,
    "",
    "PROFESSIONAL EXPERIENCE",
    ...experienceSection,
    "",
    "EDUCATION, QUALIFICATIONS AND TRAINING",
    ...educationSection
  ].join("\n");
}

function companyFromJob(jobText: string) {
  const companyMatch = jobText.match(/\b(company|organisation|organization|employer)\s*[:\-]\s*([A-Z][^\n,.]+)/i);
  if (companyMatch?.[2]) return companyMatch[2].trim();
  return "your organisation";
}

export function generateCoverLetter(
  cvText: string,
  jobText: string,
  targetRole: string,
  analysis: Analysis
) {
  const hasCv = textWords(cvText).length >= 20;
  const company = companyFromJob(jobText);
  const skills = analysis.matchedKeywords.slice(0, 5);
  const evidence = sourceBullets(cvText).slice(0, 3);
  const role = targetRole || "this role";

  return [
    "Dear Hiring Manager,",
    "",
    hasCv
      ? `I am writing to apply for the ${role} position at ${company}. My CV shows experience aligned to ${skills.join(", ") || "the requirements in the job description"}, and I am particularly interested in the opportunity to bring that experience into a role with clear impact.`
      : `I am preparing a targeted application for ${role} opportunities. This starter letter should be personalised with verified examples from my CV before sending.`,
    "",
    evidence.length
      ? `In my recent experience, I have ${evidence.map((item) => item.replace(/\.$/, "")).join("; ")}. I would bring the same practical, evidence-led approach to your team.`
      : "My background includes relevant responsibilities and transferable skills from the CV provided. I would use the interview to give specific examples of scope, tools and outcomes.",
    "",
    `The requirements that stand out most are ${analysis.matchedKeywords.slice(0, 4).join(", ") || "strong communication, delivery and attention to detail"}. I have tailored my application to make those strengths easier to identify while keeping every claim factual and grounded in my existing experience.`,
    "",
    "Thank you for considering my application. I would welcome the opportunity to discuss how my background fits the role.",
    "",
    "Yours sincerely,",
    extractName(cvText)
  ].join("\n");
}

export function generateLinkedInKit(
  cvText: string,
  targetRole: string,
  analysis: Analysis
): LinkedInKit {
  const role = targetRole || "UK job seeker";
  const skills = unique([...analysis.matchedKeywords, ...extractKeywords(cvText, 10).map(formatTerm)]).slice(0, 10);
  const firstSkills = skills.slice(0, 3).join(" | ") || "ATS-friendly CVs | Clear evidence | Practical delivery";
  const evidence = sourceBullets(cvText).slice(0, 4);

  return {
    headlines: [
      `${role} | ${firstSkills}`,
      `${role} candidate focused on ${skills.slice(0, 2).join(" and ") || "measurable outcomes"}`,
      `Open to ${role} opportunities | ${skills.slice(0, 4).join(" | ") || "UK applications"}`
    ],
    about: [
      `I am targeting ${role} opportunities and positioning my experience around clear evidence, role-relevant keywords and practical outcomes.`,
      skills.length
        ? `My profile is strongest across ${skills.slice(0, 6).join(", ")}.`
        : "My profile is strongest when the role requirements are connected directly to verified experience.",
      evidence.length
        ? `Recent CV evidence includes ${evidence.map((item) => item.replace(/\.$/, "")).join("; ")}.`
        : "I keep my applications factual, concise and tailored to each role.",
      "I am interested in roles where I can contribute quickly, communicate clearly and keep improving the way work gets delivered."
    ].join("\n\n"),
    keywordBank: skills
  };
}

export function generateInterviewPrep(targetRole: string, analysis: Analysis): InterviewPrep {
  const role = targetRole || "the role";
  const keywords = analysis.matchedKeywords.length ? analysis.matchedKeywords.slice(0, 5) : ["teamwork", "problem solving", "communication"];
  const questions = [
    `Tell me about yourself and why you are interested in ${role}.`,
    `Which part of your experience best matches ${keywords[0]}?`,
    `Describe a time you improved a process or solved a problem with limited guidance.`,
    `Tell me about a time you worked with stakeholders or customers under pressure.`,
    `What would you prioritise in your first 30 days in this role?`,
    `Which requirement in the job description would you need to develop further?`
  ];

  return {
    questions,
    worksheets: questions.slice(1, 5).map((question) => ({
      question,
      situationPrompt: "Situation: where were you working, what was happening, and why did it matter?",
      taskPrompt: "Task: what were you personally responsible for?",
      actionPrompt: "Action: what steps did you take, which tools or people were involved, and how did you communicate?",
      resultPrompt: "Result: what changed, what was measured, and what did you learn?"
    }))
  };
}
