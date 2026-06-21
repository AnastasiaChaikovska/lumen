import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  Gauge,
  Linkedin,
  LockKeyhole,
  LogOut,
  Mail,
  Mic,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserCircle
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  analyseApplication,
  generateCoverLetter,
  generateInterviewPrep,
  generateLinkedInKit,
  generateOptimizedCv
} from "./engine";
import { downloadDocx, downloadPdf, downloadText } from "./exporters";
import {
  clearAuth,
  clearSession,
  loadAuth,
  loadApplications,
  loadSession,
  saveAuth,
  saveApplications,
  saveSession
} from "./storage";
import type {
  ApplicationRecord,
  ApplicationStatus,
  AuthUser,
  CvMode,
  JobMode,
  OutputGoal,
  SearchBlocker,
  SearchStage,
  SessionData
} from "./types";

type Screen = "onboarding" | "scan" | "reveal" | "login" | "dashboard";
type WorkspaceTab =
  | "optimizer"
  | "report"
  | "cover"
  | "tracker"
  | "linkedin"
  | "interview";

interface OnboardingForm {
  targetRole: string;
  searchStage: SearchStage;
  blocker: SearchBlocker;
  cvMode: CvMode;
  jobMode: JobMode;
  outputGoal: OutputGoal;
  cvText: string;
  jobText: string;
  email: string;
}

const emptyForm: OnboardingForm = {
  targetRole: "",
  searchStage: "no-luck",
  blocker: "silence",
  cvMode: "paste",
  jobMode: "role",
  outputGoal: "bundle",
  cvText: "",
  jobText: "",
  email: ""
};

const emptyApplication = {
  company: "",
  role: "",
  link: "",
  status: "Applied" as ApplicationStatus,
  appliedAt: new Date().toISOString().slice(0, 10),
  notes: "",
  nextFollowupAt: ""
};

const demoCredentials = {
  email: "founder@lumen.test",
  password: "Lumen2026!"
};

const demoCvText = `Alex Morgan
London | alex@example.com | linkedin.com/in/alexmorgan

PROFILE
Marketing Executive with 4 years of experience delivering email campaigns, SEO content, CRM segmentation and paid social reporting for UK B2C brands.

CORE SKILLS
Campaign management, Google Analytics, CRM, SEO, stakeholder management, copywriting, reporting, Excel.

EXPERIENCE
Marketing Executive, Bright Retail, 2022-present
- Delivered weekly email campaigns to 120,000 subscribers and improved click-through rate by 18%.
- Managed CRM segmentation and campaign reporting across acquisition and retention channels.
- Coordinated social content calendar with sales and product teams.

Marketing Assistant, North Studio, 2020-2022
- Supported SEO content updates that increased organic sessions by 24%.
- Built monthly dashboards in Excel and Google Analytics for senior stakeholders.

EDUCATION
BA Marketing, University of Leeds.`;

const stageLabels: Record<SearchStage, string> = {
  started: "Just started",
  "no-luck": "Applying, no luck",
  while: "Been at this a while"
};

const blockerLabels: Record<SearchBlocker, { label: string; helper: string }> = {
  silence: {
    label: "I apply and hear nothing",
    helper: "We will focus on clarity, ATS readability and evidence above the fold."
  },
  ats: {
    label: "I think my CV is being filtered",
    helper: "We will look for parser risks, missing sections and weak keyword signals."
  },
  tailoring: {
    label: "Tailoring every job takes too long",
    helper: "We will build a reusable base and let you re-run for each role later."
  },
  confidence: {
    label: "I do not know what is wrong",
    helper: "We will turn the next step into a simple checklist instead of guesswork."
  }
};

const outputGoalLabels: Record<OutputGoal, { label: string; helper: string }> = {
  cv: {
    label: "Fix my CV first",
    helper: "Prioritise a clean ATS-ready CV and plain-text export."
  },
  bundle: {
    label: "Build the whole application pack",
    helper: "CV, cover letter, report, LinkedIn and interview prep."
  },
  interview: {
    label: "Help me get interview-ready",
    helper: "Prioritise interview questions, STAR prompts and confident positioning."
  }
};

const statuses: ApplicationStatus[] = [
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Rejected"
];

const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof FileText }> = [
  { id: "optimizer", label: "CV Optimizer", icon: FileText },
  { id: "report", label: "Match Report", icon: Gauge },
  { id: "cover", label: "Cover Letter", icon: Mail },
  { id: "tracker", label: "Tracker", icon: ClipboardList },
  { id: "linkedin", label: "LinkedIn Kit", icon: Linkedin },
  { id: "interview", label: "Interview Prep", icon: Mic }
];

function createId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function buildSession(form: OnboardingForm, previousId?: string): SessionData {
  const analysis = analyseApplication(form.cvText, form.jobText, form.targetRole);
  const optimizedCv = generateOptimizedCv(
    form.cvText,
    form.targetRole,
    form.searchStage,
    analysis
  );
  const coverLetter = generateCoverLetter(
    form.cvText,
    form.jobText,
    form.targetRole,
    analysis
  );
  const linkedInKit = generateLinkedInKit(form.cvText, form.targetRole, analysis);
  const interviewPrep = generateInterviewPrep(form.targetRole, analysis);
  const now = new Date().toISOString();

  return {
    id: previousId ?? createId(),
    email: form.email,
    targetRole: form.targetRole,
    searchStage: form.searchStage,
    blocker: form.blocker,
    cvMode: form.cvMode,
    jobMode: form.jobMode,
    outputGoal: form.outputGoal,
    cvText: form.cvText,
    jobText: form.jobText,
    analysis,
    optimizedCv,
    coverLetter,
    linkedInKit,
    interviewPrep,
    createdAt: now,
    updatedAt: now
  };
}

function buildDemoSession(email: string) {
  return buildSession({
    targetRole: "Marketing Executive",
    searchStage: "no-luck",
    blocker: "silence",
    cvMode: "paste",
    jobMode: "role",
    outputGoal: "bundle",
    cvText: demoCvText,
    jobText: "",
    email
  });
}

function scoreLabel(score: number) {
  if (score >= 82) return "ATS-ready";
  if (score >= 68) return "Close";
  if (score >= 50) return "Needs work";
  return "At risk";
}

function hasScorableSession(session: SessionData) {
  return session.cvMode === "paste" && session.cvText.trim().length >= 80;
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function isActiveFollowup(application: ApplicationRecord) {
  return (
    application.nextFollowupAt &&
    application.nextFollowupAt <= todayIso() &&
    application.status !== "Rejected" &&
    application.status !== "Offer"
  );
}

function copyText(value: string) {
  void navigator.clipboard?.writeText(value);
}

export default function App() {
  const [session, setSession] = useState<SessionData | null>(() => loadSession());
  const [authUser, setAuthUser] = useState<AuthUser | null>(() => loadAuth());
  const [applications, setApplications] = useState<ApplicationRecord[]>(() => loadApplications());
  const [screen, setScreen] = useState<Screen>(() => {
    const savedSession = loadSession();
    if (!savedSession) return "onboarding";
    return loadAuth() ? "dashboard" : "login";
  });
  const [step, setStep] = useState(0);
  const [scanProgress, setScanProgress] = useState(0);
  const [tab, setTab] = useState<WorkspaceTab>("optimizer");
  const [form, setForm] = useState<OnboardingForm>(() => {
    const saved = loadSession();
    return saved
      ? {
          targetRole: saved.targetRole,
          searchStage: saved.searchStage,
          blocker: saved.blocker ?? "silence",
          cvMode: saved.cvMode ?? (saved.cvText ? "paste" : "skip"),
          jobMode: saved.jobMode ?? (saved.jobText ? "paste" : "role"),
          outputGoal: saved.outputGoal ?? "bundle",
          cvText: saved.cvText,
          jobText: saved.jobText,
          email: saved.email
        }
      : emptyForm;
  });
  const [applicationDraft, setApplicationDraft] = useState(emptyApplication);
  const [rerunRole, setRerunRole] = useState(session?.targetRole ?? "");
  const [rerunCv, setRerunCv] = useState(session?.cvText ?? "");
  const [rerunJob, setRerunJob] = useState(session?.jobText ?? "");
  const [loginForm, setLoginForm] = useState(demoCredentials);
  const [loginError, setLoginError] = useState("");
  const onboardingTotal = 7;

  useEffect(() => {
    saveApplications(applications);
  }, [applications]);

  useEffect(() => {
    if (screen !== "scan") return;

    setScanProgress(8);
    const timer = window.setInterval(() => {
      setScanProgress((current) => {
        if (current >= 100) {
          window.clearInterval(timer);
          const nextSession = buildSession(form, session?.id);
          setSession(nextSession);
          saveSession(nextSession);
          setRerunRole(nextSession.targetRole);
          setRerunCv(nextSession.cvText);
          setRerunJob(nextSession.jobText);
          window.setTimeout(() => setScreen("reveal"), 280);
          return 100;
        }
        return Math.min(100, current + Math.floor(Math.random() * 15) + 8);
      });
    }, 240);

    return () => window.clearInterval(timer);
  }, [form, screen, session?.id]);

  const stats = useMemo(() => {
    const total = applications.length;
    const responses = applications.filter((item) =>
      ["Screening", "Interview", "Offer"].includes(item.status)
    ).length;
    const interviews = applications.filter((item) =>
      ["Interview", "Offer"].includes(item.status)
    ).length;
    const nudges = applications.filter(isActiveFollowup).length;

    return {
      total,
      responses,
      interviews,
      nudges,
      responseRate: total ? Math.round((responses / total) * 100) : 0,
      interviewRate: total ? Math.round((interviews / total) * 100) : 0
    };
  }, [applications]);

  function updateSession(next: SessionData) {
    const withTimestamp = { ...next, updatedAt: new Date().toISOString() };
    setSession(withTimestamp);
    saveSession(withTimestamp);
  }

  function startScan() {
    if (!form.targetRole.trim()) return;
    setScreen("scan");
  }

  function saveEmailAndOpenWorkspace() {
    if (!session) return;
    updateSession({ ...session, email: form.email.trim() || authUser?.email || "" });
    setScreen(authUser ? "dashboard" : "login");
  }

  function resetAll() {
    clearSession();
    setSession(null);
    setForm(emptyForm);
    setStep(0);
    setScreen("onboarding");
    setTab("optimizer");
    setRerunRole("");
    setRerunCv("");
    setRerunJob("");
  }

  function rerunAnalysis() {
    if (!session) return;
    const nextCvMode: CvMode = rerunCv.trim().length >= 80 ? "paste" : "skip";
    const nextForm = {
      targetRole: rerunRole,
      searchStage: session.searchStage,
      blocker: session.blocker,
      cvMode: nextCvMode,
      jobMode: (rerunJob.trim() ? "paste" : "role") as JobMode,
      outputGoal: session.outputGoal,
      cvText: rerunCv,
      jobText: rerunJob,
      email: session.email
    };
    updateSession(buildSession(nextForm, session.id));
  }

  function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const email = loginForm.email.trim().toLowerCase();
    const password = loginForm.password;

    if (email !== demoCredentials.email || password !== demoCredentials.password) {
      setLoginError("Use the test account shown below to open the paid workspace preview.");
      return;
    }

    const now = new Date().toISOString();
    const user: AuthUser = {
      email: demoCredentials.email,
      name: "Anastasia",
      paidAccess: true,
      createdAt: authUser?.createdAt ?? now,
      lastLoginAt: now
    };

    saveAuth(user);
    setAuthUser(user);
    setLoginError("");

    if (session) {
      updateSession({ ...session, email: session.email || user.email });
    } else {
      const demoSession = buildDemoSession(user.email);
      setSession(demoSession);
      saveSession(demoSession);
      setForm({
        targetRole: demoSession.targetRole,
        searchStage: demoSession.searchStage,
        blocker: demoSession.blocker,
        cvMode: demoSession.cvMode,
        jobMode: demoSession.jobMode,
        outputGoal: demoSession.outputGoal,
        cvText: demoSession.cvText,
        jobText: demoSession.jobText,
        email: demoSession.email
      });
      setRerunRole(demoSession.targetRole);
      setRerunCv(demoSession.cvText);
      setRerunJob(demoSession.jobText);
    }

    setScreen("dashboard");
  }

  function logout() {
    clearAuth();
    setAuthUser(null);
    setScreen(session ? "login" : "onboarding");
  }

  function addApplication() {
    if (!applicationDraft.company.trim() || !applicationDraft.role.trim()) return;
    const record: ApplicationRecord = {
      ...applicationDraft,
      id: createId(),
      createdAt: new Date().toISOString()
    };
    setApplications((items) => [record, ...items]);
    setApplicationDraft(emptyApplication);
  }

  function updateApplication(id: string, updates: Partial<ApplicationRecord>) {
    setApplications((items) =>
      items.map((item) => (item.id === id ? { ...item, ...updates } : item))
    );
  }

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => (session ? setScreen(authUser ? "dashboard" : "login") : setScreen("onboarding"))}>
          <span className="brand-mark">L</span>
          <span>
            <strong>Lumen</strong>
            <small>UK ATS application platform</small>
          </span>
        </button>
        <nav className="topbar-actions">
          {authUser && (
            <span className="account-chip" aria-label="Signed in account">
              <UserCircle size={17} />
              {authUser.email}
            </span>
          )}
          {!authUser && (
            <button className="ghost-button" onClick={() => setScreen("login")}>
              Log in
            </button>
          )}
          {session && (
            <>
              {authUser && (
                <button className="ghost-button" onClick={() => setScreen("dashboard")}>
                  Dashboard
                </button>
              )}
              <button className="ghost-button" onClick={resetAll}>
                New scan
              </button>
            </>
          )}
          {authUser && (
            <button className="ghost-button" onClick={logout}>
              <LogOut size={17} /> Log out
            </button>
          )}
        </nav>
      </header>

      {screen === "onboarding" && (
        <main className="landing-page">
          <section className="landing-shell">
            <div className="hero-panel">
              <div>
                <p className="eyebrow">Built for the UK job search</p>
                <h1>Getting silence does not mean you are not good enough.</h1>
                <p className="hero-copy">
                  The UK market is tighter, recruiters are overloaded, and a CV that made sense to a human can still be hard for screening systems to read. Lumen helps you turn what you already have into a clearer, more searchable application pack.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary-button"
                    onClick={() => document.getElementById("onboarding-flow")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Start with what you have <ArrowRight size={18} />
                  </button>
                  <button
                    className="ghost-button"
                    onClick={() => document.getElementById("market-proof")?.scrollIntoView({ behavior: "smooth" })}
                  >
                    Why it feels hard
                  </button>
                </div>
              </div>
              <div className="trust-strip" aria-label="Product safeguards">
                <span><ShieldCheck size={16} /> Pay once at launch</span>
                <span><UserCircle size={16} /> Account after unlock</span>
                <span><ShieldCheck size={16} /> No invented facts</span>
                <span><Gauge size={16} /> CV optional to start</span>
                <span><Download size={16} /> DOCX, PDF, TXT</span>
              </div>
            </div>

            <section className="onboarding-card" id="onboarding-flow">
              <Progress step={step} total={onboardingTotal} />
              {step === 0 && (
                <StepFrame
                  eyebrow={`Step 1 of ${onboardingTotal}`}
                  title="What kind of role are you trying to get?"
                  actionLabel="Continue"
                  actionDisabled={!form.targetRole.trim()}
                  onAction={() => setStep(1)}
                >
                  <input
                    className="big-input"
                    placeholder="e.g. Marketing Executive, Data Analyst, Operations Manager"
                    value={form.targetRole}
                    onChange={(event) => setForm({ ...form, targetRole: event.target.value })}
                    autoFocus
                  />
                  <div className="suggestion-row">
                    {["Project Manager", "Junior Developer", "Customer Success Manager"].map((role) => (
                      <button
                        key={role}
                        className="pill"
                        onClick={() => setForm({ ...form, targetRole: role })}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </StepFrame>
              )}

              {step === 1 && (
                <StepFrame
                  eyebrow={`Step 2 of ${onboardingTotal}`}
                  title="Where are you in the search?"
                  actionLabel="Continue"
                  onBack={() => setStep(0)}
                  onAction={() => setStep(2)}
                >
                  <div className="choice-grid">
                    {(Object.keys(stageLabels) as SearchStage[]).map((stage) => (
                      <button
                        key={stage}
                        className={`choice-card ${form.searchStage === stage ? "selected" : ""}`}
                        onClick={() => setForm({ ...form, searchStage: stage })}
                      >
                        <CheckCircle2 size={18} />
                        <span>{stageLabels[stage]}</span>
                      </button>
                    ))}
                  </div>
                </StepFrame>
              )}

              {step === 2 && (
                <StepFrame
                  eyebrow={`Step 3 of ${onboardingTotal}`}
                  title="What is the most frustrating part right now?"
                  actionLabel="Continue"
                  onBack={() => setStep(1)}
                  onAction={() => setStep(3)}
                >
                  <div className="choice-grid two">
                    {(Object.keys(blockerLabels) as SearchBlocker[]).map((blocker) => (
                      <button
                        key={blocker}
                        className={`choice-card text-heavy ${form.blocker === blocker ? "selected" : ""}`}
                        onClick={() => setForm({ ...form, blocker })}
                      >
                        <CheckCircle2 size={18} />
                        <span>{blockerLabels[blocker].label}</span>
                        <small>{blockerLabels[blocker].helper}</small>
                      </button>
                    ))}
                  </div>
                </StepFrame>
              )}

              {step === 3 && (
                <StepFrame
                  eyebrow={`Step 4 of ${onboardingTotal}`}
                  title="Do you have your CV with you?"
                  actionLabel={form.cvMode === "paste" ? "Scan my CV" : "Continue without CV"}
                  actionDisabled={form.cvMode === "paste" && form.cvText.trim().length < 80}
                  onBack={() => setStep(2)}
                  onAction={() => setStep(4)}
                >
                  <div className="choice-grid">
                    <button
                      className={`choice-card ${form.cvMode === "paste" ? "selected" : ""}`}
                      onClick={() => setForm({ ...form, cvMode: "paste" })}
                    >
                      <FileText size={18} />
                      <span>Yes, I can paste it</span>
                    </button>
                    <button
                      className={`choice-card ${form.cvMode === "skip" ? "selected" : ""}`}
                      onClick={() => setForm({ ...form, cvMode: "skip", cvText: "" })}
                    >
                      <ArrowRight size={18} />
                      <span>Not right now</span>
                    </button>
                    <button
                      className={`choice-card ${form.cvMode === "starter" ? "selected" : ""}`}
                      onClick={() => setForm({ ...form, cvMode: "starter", cvText: "" })}
                    >
                      <Sparkles size={18} />
                      <span>I need a starter structure</span>
                    </button>
                  </div>
                  {form.cvMode === "paste" ? (
                    <>
                      <textarea
                        className="large-textarea"
                        placeholder="Paste the full CV text here. Keep names, roles and achievements as they are so Lumen can stay factual."
                        value={form.cvText}
                        onChange={(event) => setForm({ ...form, cvText: event.target.value })}
                      />
                      <p className="field-note">
                        Minimum useful input is around 80 characters. If your CV is not nearby, choose "Not right now" and keep going.
                      </p>
                    </>
                  ) : (
                    <p className="soft-note">
                      No problem. We will build a role-focused plan first, then you can paste your CV later for a true ATS scan.
                    </p>
                  )}
                </StepFrame>
              )}

              {step === 4 && (
                <StepFrame
                  eyebrow={`Step 5 of ${onboardingTotal}`}
                  title="Do you have a specific job advert?"
                  actionLabel={form.jobMode === "paste" ? "Use this advert" : "Optimise for my target role"}
                  actionDisabled={form.jobMode === "paste" && form.jobText.trim().length < 40}
                  onBack={() => setStep(3)}
                  onAction={() => setStep(5)}
                >
                  <div className="choice-grid two">
                    <button
                      className={`choice-card text-heavy ${form.jobMode === "role" ? "selected" : ""}`}
                      onClick={() => setForm({ ...form, jobMode: "role", jobText: "" })}
                    >
                      <Briefcase size={18} />
                      <span>No, just build for {form.targetRole || "my target role"}</span>
                      <small>Best when you are searching generally or browsing on your phone.</small>
                    </button>
                    <button
                      className={`choice-card text-heavy ${form.jobMode === "paste" ? "selected" : ""}`}
                      onClick={() => setForm({ ...form, jobMode: "paste" })}
                    >
                      <ClipboardList size={18} />
                      <span>Yes, I will paste it</span>
                      <small>Best when you want a tighter keyword match for one application.</small>
                    </button>
                  </div>
                  {form.jobMode === "paste" && (
                    <textarea
                      className="large-textarea"
                      placeholder="Paste the job advert here. You can also go back and choose target-role mode if it is not nearby."
                      value={form.jobText}
                      onChange={(event) => setForm({ ...form, jobText: event.target.value })}
                    />
                  )}
                </StepFrame>
              )}

              {step === 5 && (
                <StepFrame
                  eyebrow={`Step 6 of ${onboardingTotal}`}
                  title="What would feel most useful today?"
                  actionLabel="Continue"
                  onBack={() => setStep(4)}
                  onAction={() => setStep(6)}
                >
                  <div className="choice-grid">
                    {(Object.keys(outputGoalLabels) as OutputGoal[]).map((goal) => (
                      <button
                        key={goal}
                        className={`choice-card text-heavy ${form.outputGoal === goal ? "selected" : ""}`}
                        onClick={() => setForm({ ...form, outputGoal: goal })}
                      >
                        <CheckCircle2 size={18} />
                        <span>{outputGoalLabels[goal].label}</span>
                        <small>{outputGoalLabels[goal].helper}</small>
                      </button>
                    ))}
                  </div>
                </StepFrame>
              )}

              {step === 6 && (
                <StepFrame
                  eyebrow={`Step 7 of ${onboardingTotal}`}
                  title="Ready to see what is holding things back?"
                  actionLabel={form.cvMode === "paste" ? "Run CV scan" : "Build my plan"}
                  onBack={() => setStep(5)}
                  onAction={startScan}
                >
                  <div className="review-box">
                    <span>Target role</span>
                    <strong>{form.targetRole}</strong>
                    <span>Current blocker</span>
                    <strong>{blockerLabels[form.blocker].label}</strong>
                    <span>CV input</span>
                    <strong>{form.cvMode === "paste" ? "CV pasted for analysis" : "Skipped for now"}</strong>
                    <span>Job advert</span>
                    <strong>{form.jobMode === "paste" ? "Specific advert pasted" : "Target-role mode"}</strong>
                  </div>
                  <p className="soft-note">
                    The free reveal shows a real score when there is a CV to analyse, or a starter readiness plan when there is not. The full CV, cover letter, exports and report come after the unlock point.
                  </p>
                </StepFrame>
              )}
            </section>
          </section>

          <section className="market-section" id="market-proof">
            <div>
              <p className="eyebrow">Why it feels harder than it should</p>
              <h2>The market is doing part of this to you.</h2>
              <p>
                If you are applying and hearing nothing, it is not automatically a sign that you are under-qualified. UK vacancies have fallen, competition is sharper, and recruiters often have seconds to decide whether a CV is readable enough to continue.
              </p>
            </div>
            <div className="market-stats">
              <div>
                <strong>707k</strong>
                <span>UK vacancies in March to May 2026, the lowest since February to April 2021.</span>
              </div>
              <div>
                <strong>4.9%</strong>
                <span>UK unemployment rate for people aged 16+ in February to April 2026.</span>
              </div>
              <div>
                <strong>16.2%</strong>
                <span>Youth unemployment, described by Indeed Hiring Lab as the highest in over a decade.</span>
              </div>
            </div>
            <p className="source-line">
              Sources: ONS Labour Market Overview, June 2026; Indeed Hiring Lab, June 2026.
            </p>
          </section>

          <section className="selling-section">
            <div className="section-heading">
              <p className="eyebrow">What Lumen does differently</p>
              <h2>It starts where real job seekers are: messy, tired and without every document open.</h2>
            </div>
            <div className="selling-grid">
              <article>
                <FileText size={22} />
                <h3>Have your CV? We scan it.</h3>
                <p>Get a specific match score, formatting risks, missing keywords and the top fixes before the unlock point.</p>
              </article>
              <article>
                <Briefcase size={22} />
                <h3>No job advert? Still works.</h3>
                <p>Start with the role you want. Paste a specific advert later when you are ready to tailor an application.</p>
              </article>
              <article>
                <Sparkles size={22} />
                <h3>No CV nearby? Keep moving.</h3>
                <p>Build a starter plan and role-ready structure first, then add the CV text when you can.</p>
              </article>
              <article>
                <ShieldCheck size={22} />
                <h3>No subscription trap.</h3>
                <p>The intended launch model is one payment for the full pack, with fair-use re-runs for your search.</p>
              </article>
            </div>
          </section>

          <section className="offer-band">
            <div>
              <p className="eyebrow">The unlock later</p>
              <h2>See the problem first. Pay once only if the fix is worth it.</h2>
            </div>
            <div className="offer-list">
              <span>ATS-ready CV</span>
              <span>Cover letter</span>
              <span>Full report</span>
              <span>Saved account workspace</span>
              <span>DOCX / PDF / TXT</span>
              <span>Tracker</span>
              <span>LinkedIn + interview prep</span>
            </div>
          </section>
        </main>
      )}

      {screen === "scan" && (
        <main className="scan-screen">
          <div className="scan-orb">
            <Sparkles size={42} />
          </div>
          <p className="eyebrow">{form.cvMode === "paste" ? "Checking ATS compatibility" : "Building your route in"}</p>
          <h1>
            {form.cvMode === "paste"
              ? "Reading the CV like a parser, then like a recruiter."
              : "Starting with the role, then leaving space for your CV later."}
          </h1>
          <div className="scan-bar">
            <span style={{ width: `${scanProgress}%` }} />
          </div>
          <ul className="scan-steps">
            <li className={scanProgress > 15 ? "done" : ""}>Finding role keywords</li>
            <li className={scanProgress > 38 ? "done" : ""}>
              {form.cvMode === "paste" ? "Checking ATS formatting risk" : "Creating a CV structure you can complete"}
            </li>
            <li className={scanProgress > 62 ? "done" : ""}>
              {form.cvMode === "paste" ? "Looking for evidence and metrics" : "Turning the blocker into next steps"}
            </li>
            <li className={scanProgress > 82 ? "done" : ""}>Building the application pack</li>
          </ul>
        </main>
      )}

      {screen === "reveal" && session && (
        <main className="reveal-shell">
          <section className="score-card reveal-score">
            {hasScorableSession(session) ? (
              <ScoreGauge score={session.analysis.score} />
            ) : (
              <NoScoreBadge />
            )}
            <div>
              <p className="eyebrow">Free reveal</p>
              <h1>
                {hasScorableSession(session)
                  ? `You are ${100 - session.analysis.score} points from an ATS-ready application.`
                  : session.jobMode === "paste"
                    ? "No CV score yet. We can still build the route."
                    : "No score yet, and that is the right answer."}
              </h1>
              <p>
                {hasScorableSession(session) ? (
                  <>
                    Score: <strong>{session.analysis.score}/100</strong> ({scoreLabel(session.analysis.score)}). Here is what is holding it back.
                  </>
                ) : (
                  <>
                    Without your CV, Lumen should not pretend to know your ATS match. We will build a role-ready structure for <strong>{session.targetRole}</strong> first, then you can paste your CV later for a real scan.
                  </>
                )}
              </p>
            </div>
          </section>
          <section className="reveal-grid">
            <div className="panel">
              <h2>{session.cvMode === "paste" ? "Top 3 issues" : "Top 3 next steps"}</h2>
              <IssueList items={session.analysis.topIssues} />
            </div>
            <div className="panel unlock-panel">
              <h2>Unlock full application pack</h2>
              <p>
                The paywall slot goes here later. The intended model is a one-time launch payment, not a trial or subscription. After checkout, the receipt link should bring the user back into their account workspace.
              </p>
              <div className="pricing-preview" aria-label="Planned pricing">
                <div>
                  <span>Launch plan</span>
                  <strong>£19</strong>
                  <small>one payment, lifetime access</small>
                </div>
                <ul>
                  <li>ATS-ready CV, cover letter, full report and exports</li>
                  <li>Unlimited re-runs within fair use</li>
                  <li>Optional +£7 checkout bump: Interview Answer Workbook</li>
                </ul>
              </div>
              <label className="field-label" htmlFor="email">Email for saving this scan</label>
              <input
                id="email"
                className="text-input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
              />
              <button className="primary-button full" onClick={saveEmailAndOpenWorkspace}>
                Continue to account preview <ArrowRight size={18} />
              </button>
              <p className="privacy-line">
                Next you will use the test account to view the paid workspace as a returning customer.
              </p>
            </div>
          </section>
        </main>
      )}

      {screen === "login" && (
        <LoginScreen
          loginForm={loginForm}
          loginError={loginError}
          onChange={setLoginForm}
          onSubmit={handleLogin}
        />
      )}

      {screen === "dashboard" && session && authUser && (
        <main className="workspace">
          <aside className="workspace-sidebar">
            <div className="compact-score">
              {hasScorableSession(session) ? (
                <>
                  <ScoreGauge score={session.analysis.score} compact />
                  <span>{scoreLabel(session.analysis.score)}</span>
                </>
              ) : (
                <>
                  <NoScoreBadge compact />
                  <span>No score yet</span>
                </>
              )}
            </div>
            <div className="tab-list" role="tablist" aria-label="Workspace">
              {tabs.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    className={`tab-button ${tab === item.id ? "active" : ""}`}
                    onClick={() => setTab(item.id)}
                  >
                    <Icon size={18} />
                    {item.label}
                  </button>
                );
              })}
            </div>
            <div className="sidebar-note">
              <strong>Paid workspace:</strong> the £19 checkout should unlock this account via receipt link or magic link. No trial, no subscription.
            </div>
          </aside>

          <section className="workspace-content">
            <div className="workspace-header">
              <div>
                <p className="eyebrow">Workspace</p>
                <h1>{session.targetRole || "Target role"} application pack</h1>
              </div>
              <button className="ghost-button" onClick={() => setScreen("reveal")}>
                View reveal
              </button>
            </div>

            {tab === "optimizer" && (
              <OptimizerTab
                session={session}
                rerunRole={rerunRole}
                rerunCv={rerunCv}
                rerunJob={rerunJob}
                setRerunRole={setRerunRole}
                setRerunCv={setRerunCv}
                setRerunJob={setRerunJob}
                rerunAnalysis={rerunAnalysis}
                updateOptimizedCv={(optimizedCv) => updateSession({ ...session, optimizedCv })}
              />
            )}

            {tab === "report" && <ReportTab session={session} />}

            {tab === "cover" && (
              <EditableDocumentTab
                title="Cover Letter"
                filenameBase="lumen-cover-letter"
                value={session.coverLetter}
                onChange={(coverLetter) => updateSession({ ...session, coverLetter })}
              />
            )}

            {tab === "tracker" && (
              <TrackerTab
                applications={applications}
                stats={stats}
                draft={applicationDraft}
                setDraft={setApplicationDraft}
                addApplication={addApplication}
                updateApplication={updateApplication}
                deleteApplication={(id) =>
                  setApplications((items) => items.filter((item) => item.id !== id))
                }
              />
            )}

            {tab === "linkedin" && <LinkedInTab session={session} />}

            {tab === "interview" && <InterviewTab session={session} />}
          </section>
        </main>
      )}
    </div>
  );
}

function Progress({ step, total }: { step: number; total: number }) {
  return (
    <div className="progress-dots" aria-label={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, item) => (
        <span key={item} className={item <= step ? "active" : ""} />
      ))}
    </div>
  );
}

function StepFrame({
  eyebrow,
  title,
  children,
  actionLabel,
  actionDisabled,
  onBack,
  onAction
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  actionLabel: string;
  actionDisabled?: boolean;
  onBack?: () => void;
  onAction: () => void;
}) {
  return (
    <div className="step-frame">
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      <div className="step-body">{children}</div>
      <div className="step-actions">
        {onBack ? (
          <button className="ghost-button" onClick={onBack}>
            <ArrowLeft size={18} /> Back
          </button>
        ) : (
          <span />
        )}
        <button className="primary-button" disabled={actionDisabled} onClick={onAction}>
          {actionLabel} <ArrowRight size={18} />
        </button>
      </div>
    </div>
  );
}

function LoginScreen({
  loginForm,
  loginError,
  onChange,
  onSubmit
}: {
  loginForm: typeof demoCredentials;
  loginError: string;
  onChange: (value: typeof demoCredentials) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="login-shell">
      <section className="login-card">
        <div className="login-icon">
          <LockKeyhole size={34} />
        </div>
        <p className="eyebrow">Account workspace</p>
        <h1>Your paid link should open a saved workspace.</h1>
        <p>
          In the live flow, checkout creates or finds the account from the buyer email and sends them back here. For testing, use the seeded account below; if you have not run a scan yet, it opens a ready-made demo workspace.
        </p>

        <div className="credential-box" aria-label="Test login credentials">
          <span>Test email</span>
          <strong>{demoCredentials.email}</strong>
          <span>Test password</span>
          <strong>{demoCredentials.password}</strong>
        </div>

        <form className="login-form" onSubmit={onSubmit}>
          <label>
            Email
            <input
              className="text-input"
              type="email"
              value={loginForm.email}
              onChange={(event) => onChange({ ...loginForm, email: event.target.value })}
            />
          </label>
          <label>
            Password
            <input
              className="text-input"
              type="password"
              value={loginForm.password}
              onChange={(event) => onChange({ ...loginForm, password: event.target.value })}
            />
          </label>
          {loginError && <p className="form-error">{loginError}</p>}
          <button className="primary-button full" type="submit">
            Log in to workspace <ArrowRight size={18} />
          </button>
        </form>
      </section>
    </main>
  );
}

function ScoreGauge({ score, compact = false }: { score: number; compact?: boolean }) {
  return (
    <div
      className={`score-gauge ${compact ? "compact" : ""}`}
      style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}
      aria-label={`ATS match score ${score} out of 100`}
    >
      <div>
        <strong>{score}</strong>
        {!compact && <span>/100</span>}
      </div>
    </div>
  );
}

function NoScoreBadge({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`no-score-badge ${compact ? "compact" : ""}`} aria-label="No ATS score yet">
      <ShieldCheck size={compact ? 20 : 34} />
      {!compact && (
        <div>
          <strong>No score yet</strong>
          <span>Add CV to scan</span>
        </div>
      )}
    </div>
  );
}

function IssueList({ items }: { items: string[] }) {
  return (
    <ul className="issue-list">
      {items.map((item) => (
        <li key={item}>
          <span />
          {item}
        </li>
      ))}
    </ul>
  );
}

function OptimizerTab({
  session,
  rerunRole,
  rerunCv,
  rerunJob,
  setRerunRole,
  setRerunCv,
  setRerunJob,
  rerunAnalysis,
  updateOptimizedCv
}: {
  session: SessionData;
  rerunRole: string;
  rerunCv: string;
  rerunJob: string;
  setRerunRole: (value: string) => void;
  setRerunCv: (value: string) => void;
  setRerunJob: (value: string) => void;
  rerunAnalysis: () => void;
  updateOptimizedCv: (value: string) => void;
}) {
  return (
    <div className="stack">
      <section className="panel retarget-panel">
        <div>
          <h2>Re-run for another job</h2>
          <p>Paste or replace the CV and add a job advert when you have one. A real ATS score appears once there is enough CV text to analyse.</p>
        </div>
        <div className="retarget-grid">
          <input
            className="text-input"
            value={rerunRole}
            onChange={(event) => setRerunRole(event.target.value)}
            placeholder="Target role"
          />
          <button className="secondary-button" onClick={rerunAnalysis}>
            <RefreshCw size={17} /> Re-run
          </button>
        </div>
        <textarea
          className="small-textarea"
          value={rerunCv}
          onChange={(event) => setRerunCv(event.target.value)}
          placeholder="Paste or replace CV text here"
        />
        <textarea
          className="small-textarea"
          value={rerunJob}
          onChange={(event) => setRerunJob(event.target.value)}
          placeholder="Paste new job description"
        />
      </section>

      <section className="document-grid">
        <div className="panel document-panel">
          <div className="panel-heading">
            <h2>Original CV</h2>
            <button className="ghost-button" disabled={!session.cvText.trim()} onClick={() => copyText(session.cvText)}>Copy</button>
          </div>
          <pre>{session.cvText || "No CV has been added yet. Paste it into the re-run panel above when you have it, then re-run to unlock a proper ATS score."}</pre>
        </div>
        <div className="panel document-panel">
          <div className="panel-heading">
            <h2>Optimized CV</h2>
            <ExportButtons title="Lumen ATS CV" filenameBase="lumen-ats-cv" body={session.optimizedCv} />
          </div>
          <textarea
            className="document-editor"
            value={session.optimizedCv}
            onChange={(event) => updateOptimizedCv(event.target.value)}
          />
        </div>
      </section>
    </div>
  );
}

function ReportTab({ session }: { session: SessionData }) {
  const canScore = hasScorableSession(session);

  return (
    <div className="report-grid">
      <section className="panel score-card">
        {canScore ? <ScoreGauge score={session.analysis.score} /> : <NoScoreBadge />}
        <div>
          <p className="eyebrow">{canScore ? "Current match" : "Starter report"}</p>
          <h2>{canScore ? scoreLabel(session.analysis.score) : "No ATS score yet"}</h2>
          <p>
            {canScore
              ? "Re-score after editing by using the re-run panel in CV Optimizer."
              : "Add your CV in CV Optimizer and re-run. Until then, this report stays focused on role readiness and next steps."}
          </p>
        </div>
      </section>
      <section className="panel">
        <h2>Keyword gaps</h2>
        <div className="keyword-cloud">
          {session.analysis.keywordGaps.length ? (
            session.analysis.keywordGaps.map((keyword) => <span key={keyword}>{keyword}</span>)
          ) : (
            <p>No major gaps detected.</p>
          )}
        </div>
      </section>
      <section className="panel">
        <h2>What to fix</h2>
        <IssueList items={session.analysis.allIssues} />
      </section>
      <section className="panel">
        <h2>{canScore ? "5 steps to raise the score" : "5 steps to get ready for scoring"}</h2>
        <ol className="number-list">
          {session.analysis.improvementSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      <section className="panel">
        <h2>Section notes</h2>
        <IssueList items={session.analysis.sectionNotes} />
      </section>
      <section className="panel">
        <h2>Strengths</h2>
        <IssueList items={session.analysis.strengths.length ? session.analysis.strengths : ["No strong matches yet. Add more role-specific evidence from your CV."]} />
      </section>
    </div>
  );
}

function EditableDocumentTab({
  title,
  filenameBase,
  value,
  onChange
}: {
  title: string;
  filenameBase: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="panel document-panel single-document">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Editable export</p>
          <h2>{title}</h2>
        </div>
        <ExportButtons title={title} filenameBase={filenameBase} body={value} />
      </div>
      <textarea
        className="document-editor tall"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
    </section>
  );
}

function ExportButtons({
  title,
  filenameBase,
  body
}: {
  title: string;
  filenameBase: string;
  body: string;
}) {
  return (
    <div className="export-buttons">
      <button className="mini-button" onClick={() => downloadText(`${filenameBase}.txt`, body)}>
        TXT
      </button>
      <button className="mini-button" onClick={() => void downloadDocx(`${filenameBase}.docx`, title, body)}>
        DOCX
      </button>
      <button className="mini-button" onClick={() => void downloadPdf(`${filenameBase}.pdf`, title, body)}>
        PDF
      </button>
    </div>
  );
}

function TrackerTab({
  applications,
  stats,
  draft,
  setDraft,
  addApplication,
  updateApplication,
  deleteApplication
}: {
  applications: ApplicationRecord[];
  stats: {
    total: number;
    responses: number;
    interviews: number;
    nudges: number;
    responseRate: number;
    interviewRate: number;
  };
  draft: typeof emptyApplication;
  setDraft: (value: typeof emptyApplication) => void;
  addApplication: () => void;
  updateApplication: (id: string, updates: Partial<ApplicationRecord>) => void;
  deleteApplication: (id: string) => void;
}) {
  return (
    <div className="stack">
      <section className="stats-grid">
        <Stat label="Applications" value={stats.total.toString()} />
        <Stat label="Response rate" value={`${stats.responseRate}%`} />
        <Stat label="Interview rate" value={`${stats.interviewRate}%`} />
        <Stat label="Follow-up due" value={stats.nudges.toString()} />
      </section>

      <section className="panel tracker-form">
        <h2>Add application</h2>
        <div className="form-grid">
          <input
            className="text-input"
            placeholder="Company"
            value={draft.company}
            onChange={(event) => setDraft({ ...draft, company: event.target.value })}
          />
          <input
            className="text-input"
            placeholder="Role"
            value={draft.role}
            onChange={(event) => setDraft({ ...draft, role: event.target.value })}
          />
          <input
            className="text-input"
            placeholder="Job link"
            value={draft.link}
            onChange={(event) => setDraft({ ...draft, link: event.target.value })}
          />
          <select
            className="text-input"
            value={draft.status}
            onChange={(event) => setDraft({ ...draft, status: event.target.value as ApplicationStatus })}
          >
            {statuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
          <label>
            Applied
            <input
              className="text-input"
              type="date"
              value={draft.appliedAt}
              onChange={(event) => setDraft({ ...draft, appliedAt: event.target.value })}
            />
          </label>
          <label>
            Follow-up
            <input
              className="text-input"
              type="date"
              value={draft.nextFollowupAt}
              onChange={(event) => setDraft({ ...draft, nextFollowupAt: event.target.value })}
            />
          </label>
        </div>
        <textarea
          className="small-textarea"
          placeholder="Notes"
          value={draft.notes}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
        />
        <button className="primary-button" onClick={addApplication}>
          <Plus size={18} /> Add application
        </button>
      </section>

      <section className="application-list">
        {applications.length ? (
          applications.map((application) => (
            <article
              className={`application-card ${isActiveFollowup(application) ? "followup" : ""}`}
              key={application.id}
            >
              <div>
                <h3>{application.role}</h3>
                <p>{application.company}</p>
                {application.link && (
                  <a href={application.link} target="_blank" rel="noreferrer">
                    Job link
                  </a>
                )}
              </div>
              <select
                className="text-input"
                value={application.status}
                onChange={(event) =>
                  updateApplication(application.id, { status: event.target.value as ApplicationStatus })
                }
              >
                {statuses.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
              <div className="application-meta">
                <span>Applied {application.appliedAt || "n/a"}</span>
                <span>Follow-up {application.nextFollowupAt || "not set"}</span>
              </div>
              <textarea
                className="notes-input"
                value={application.notes}
                onChange={(event) => updateApplication(application.id, { notes: event.target.value })}
              />
              <button className="icon-button" aria-label="Delete application" onClick={() => deleteApplication(application.id)}>
                <Trash2 size={17} />
              </button>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <Briefcase size={34} />
            <h2>No applications yet</h2>
            <p>Add the roles you apply for and Lumen will track response rate, interview rate and follow-up dates.</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function LinkedInTab({ session }: { session: SessionData }) {
  return (
    <div className="report-grid">
      <section className="panel">
        <h2>Headline options</h2>
        <div className="copy-list">
          {session.linkedInKit.headlines.map((headline) => (
            <button key={headline} onClick={() => copyText(headline)}>
              {headline}
            </button>
          ))}
        </div>
      </section>
      <section className="panel">
        <div className="panel-heading">
          <h2>About section</h2>
          <button className="ghost-button" onClick={() => copyText(session.linkedInKit.about)}>Copy</button>
        </div>
        <pre className="text-output">{session.linkedInKit.about}</pre>
      </section>
      <section className="panel">
        <h2>Keyword bank</h2>
        <div className="keyword-cloud">
          {session.linkedInKit.keywordBank.map((keyword) => (
            <span key={keyword}>{keyword}</span>
          ))}
        </div>
      </section>
    </div>
  );
}

function InterviewTab({ session }: { session: SessionData }) {
  return (
    <div className="stack">
      <section className="panel">
        <h2>Likely questions</h2>
        <IssueList items={session.interviewPrep.questions} />
      </section>
      <section className="worksheet-grid">
        {session.interviewPrep.worksheets.map((worksheet) => (
          <article className="panel worksheet" key={worksheet.question}>
            <h3>{worksheet.question}</h3>
            <p><strong>Situation:</strong> {worksheet.situationPrompt}</p>
            <p><strong>Task:</strong> {worksheet.taskPrompt}</p>
            <p><strong>Action:</strong> {worksheet.actionPrompt}</p>
            <p><strong>Result:</strong> {worksheet.resultPrompt}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
