import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Database,
  FileCheck2,
  FileJson,
  Filter,
  History,
  Layers3,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Settings,
  UserRound,
  Wrench,
  X,
} from "lucide-react";
import LoadingState from "./components/ui/LoadingState";
import type { Opportunity, SourceConfig } from "./types";

type View = "landing" | "opportunities" | "assistant" | "sources";
type DetailTab = "summary" | "evidence" | "raw" | "changes" | "copilot";
type SourceRunView = {
  status: string;
  rowCount: number;
  validRowCount: number;
  startedAt: string;
  finishedAt: string;
  metrics?: { requiredFieldCompleteness: number; dateParseRate: number };
  problems: string[];
};
type SourceView = SourceConfig & {
  latestRun: SourceRunView | null;
  lastSuccessfulRun: SourceRunView | null;
};
type HealingRecord = {
  sourceId: string;
  sourceName: string;
  collectorId: string;
  status: "verified" | "contained";
  detected: string;
  repair: string;
  outcome: string;
  sameCollectorId: boolean;
  proposalReviewed: boolean;
  approved: boolean;
};
const fmt = (value: string | null, timezone?: string) =>
  value
    ? new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: timezone ?? "UTC",
        timeZoneName: "short",
      }).format(new Date(value))
    : "Not stated";
const label = (value: string) =>
  value.replaceAll("_", " ").replace(/\b\w/g, (char) => char.toUpperCase());

function Brand({ onClick }: { onClick?: () => void }) {
  return (
    <button className="brand" onClick={onClick} aria-label="SecureContract home">
      <span className="brand-mark">
        <ShieldCheck size={21} />
      </span>
      <span>SecureContract</span>
    </button>
  );
}
function Status({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "good" | "warn" | "bad" | "info" | "neutral";
}) {
  return <span className={`status status-${tone}`}>{children}</span>;
}

function Header({
  view,
  setView,
  provenance,
}: {
  view: View;
  setView: (view: View) => void;
  provenance: string;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const mode =
    provenance === "postgres"
      ? "Persistence-backed"
      : provenance === "recorded_live"
        ? "Recorded source snapshot"
        : "Source configuration required";
  const navigation: Array<[View, string]> = [
    ["opportunities", "Discover"],
    ["assistant", "Ask AI"],
    ["sources", "Operations"],
  ];
  return (
    <header>
      <Brand onClick={() => setView("landing")} />
      <nav aria-label="Primary">
        {navigation.map(([item, text]) => (
          <button
            key={item}
            className={view === item ? "active" : ""}
            onClick={() => setView(item)}
          >
            {text}
          </button>
        ))}
      </nav>
      <div className="demo-label">{mode}</div>
      <div className="profile-menu">
        <button
          className="avatar-toggle"
          aria-label="Open account menu"
          aria-haspopup="menu"
          aria-expanded={profileOpen}
          onClick={() => setProfileOpen((open) => !open)}
        >
          <span className="avatar">AD</span>
          <ChevronDown size={14} />
        </button>
        {profileOpen && (
          <div className="profile-dropdown" role="menu">
            <div className="profile-summary">
              <span className="avatar">AD</span>
              <div>
                <strong>Aditya Das</strong>
                <small>Workspace owner</small>
              </div>
            </div>
            <button role="menuitem" onClick={() => setProfileOpen(false)}>
              <UserRound size={15} /> Profile
            </button>
            <button role="menuitem" onClick={() => setProfileOpen(false)}>
              <Settings size={15} /> Preferences
            </button>
            <button className="profile-signout" role="menuitem" onClick={() => setProfileOpen(false)}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

function LandingPage({
  onStart,
  onAssistant,
  opportunityCount,
  sourceCount,
  featured,
}: {
  onStart: () => void;
  onAssistant: () => void;
  opportunityCount: number;
  sourceCount: number;
  featured: Opportunity | null;
}) {
  return (
    <main className="landing-page">
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="eyebrow">Public procurement intelligence</p>
          <h1>Build your bid pipeline with context.</h1>
          <p className="landing-lede">
            A focused workspace for finding public opportunities, reviewing the original record, and preparing a confident next move.
          </p>
          <div className="landing-actions">
            <button className="primary landing-primary" onClick={onStart}>
              Browse opportunities <ArrowRight size={16} />
            </button>
            <button className="secondary" onClick={onAssistant}>
              Research with AI
            </button>
          </div>
          <div className="landing-brief-points">
            <span><Search size={15} /> Discovery</span>
            <span><FileCheck2 size={15} /> Source review</span>
            <span><Layers3 size={15} /> Operations</span>
          </div>
        </div>
        <div className="landing-record" aria-label="Current opportunity in the workspace">
          <div className="landing-record-topline">
            <span>In the current workspace</span>
            <span>{featured ? label(featured.status) : "No record selected"}</span>
          </div>
          {featured ? (
            <>
              <div className="landing-record-title">
                <Building2 size={20} />
                <div>
                  <strong>{featured.titleEnglish ?? featured.titleOriginal}</strong>
                  <small>{featured.buyerOriginal}</small>
                </div>
              </div>
              <dl className="landing-record-facts">
                <div><dt>Location</dt><dd>{featured.countryName}{featured.jurisdiction ? ` / ${featured.jurisdiction}` : ""}</dd></div>
                <div><dt>Deadline</dt><dd>{fmt(featured.submissionDueAt, featured.localTimezone)}</dd></div>
                <div><dt>Procedure</dt><dd>{label(featured.procedureType)}</dd></div>
                <div><dt>Record fields</dt><dd>{featured.evidence.length} documented</dd></div>
              </dl>
              <div className="landing-record-footer">
                <span><FileJson size={15} /> Original record retained</span>
                <a href={featured.detailUrl ?? featured.sourceUrl} target="_blank" rel="noreferrer">Open source <ArrowUpRight size={14} /></a>
              </div>
            </>
          ) : (
            <div className="landing-record-empty">
              <Database size={22} />
              <p>Connect a source and publish accepted records to begin research.</p>
            </div>
          )}
        </div>
      </section>
      <section className="landing-metrics" aria-label="Platform summary">
        <div><strong>{opportunityCount.toLocaleString()}</strong><span>accepted opportunity records</span></div>
        <div><strong>{sourceCount || "—"}</strong><span>configured source systems</span></div>
        <div><strong>1 research desk</strong><span>from discovery to decision</span></div>
      </section>
      <section className="landing-workflow">
        <div className="landing-workflow-intro">
          <p className="eyebrow">A deliberate workflow</p>
          <h2>Less hunting. More signal.</h2>
          <p>Move directly between the work that matters: identifying a fit, checking the record, and managing the source operations behind it.</p>
        </div>
        <div className="landing-workflow-list">
          <article><span>01</span><div><h3>Discover the right fit</h3><p>Search the current contract record set with precise filters and a readable, paginated result table.</p></div><ArrowRight size={17} /></article>
          <article><span>02</span><div><h3>Review the actual record</h3><p>Inspect deadlines, changes, documents, and original-source links in one focused detail panel.</p></div><ArrowRight size={17} /></article>
          <article><span>03</span><div><h3>Research with traceability</h3><p>Ask questions against accepted records and keep the supporting opportunities within reach.</p></div><ArrowRight size={17} /></article>
        </div>
      </section>
    </main>
  );
}

function OpportunityTable({
  items,
  selected,
  onSelect,
}: {
  items: Opportunity[];
  selected: Opportunity | null;
  onSelect: (opportunity: Opportunity) => void;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Opportunity</th>
            <th>Buyer</th>
            <th>Country / jurisdiction</th>
            <th>Procedure</th>
            <th>Deadline</th>
            <th>Status</th>
            <th>Changed</th>
            <th>Verification</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className={selected?.id === item.id ? "selected" : ""}
              onClick={() => onSelect(item)}
            >
              <td>
                <button className="title-link">{item.titleOriginal}</button>
                <small>{item.externalId ?? "No official ID"}</small>
              </td>
              <td>{item.buyerOriginal}</td>
              <td>
                {item.countryName}
                <small>{item.jurisdiction ?? "National"}</small>
              </td>
              <td>{label(item.procedureType)}</td>
              <td className="deadline">
                {fmt(item.submissionDueAt, item.localTimezone)}
              </td>
              <td>
                <Status tone={item.status === "open" ? "good" : "neutral"}>
                  {label(item.status)}
                </Status>
              </td>
              <td>
                {item.changes.length ? (
                  <span
                    className={
                      item.changes.some(
                        (change) => change.severity === "critical",
                      )
                        ? "critical-text"
                        : "changed"
                    }
                  >
                    <CircleDot size={12} />
                    {item.changes.length} change
                    {item.changes.length > 1 ? "s" : ""}
                  </span>
                ) : (
                  <span className="muted">None</span>
                )}
              </td>
              <td>
                {item.verification === "verified" ? (
                  <span className="verified">
                    <CheckCircle2 size={15} />
                    Verified
                  </span>
                ) : item.verification === "last_known_good" ? (
                  <span className="warn">
                    <History size={15} />
                    Last known good
                  </span>
                ) : (
                  <span className="warn">
                    <AlertTriangle size={15} />
                    Partial
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {items.length === 0 && (
        <div className="empty">
          <Search />
          <h3>No opportunities match</h3>
          <p>Try removing a filter or changing the search.</p>
        </div>
      )}
    </div>
  );
}

function Summary({
  item,
  sources,
}: {
  item: Opportunity;
  sources: SourceConfig[];
}) {
  const source = sources.find((source) => source.id === item.sourceId);
  return (
    <div className="detail-body">
      <section className="summary-grid">
        <div>
          <label>Official title</label>
          <strong>{item.titleOriginal}</strong>
        </div>
        <div>
          <label>Buyer</label>
          <strong>{item.buyerOriginal}</strong>
        </div>
        <div>
          <label>Country / jurisdiction</label>
          <strong>
            {item.countryName}
            {item.jurisdiction ? ` · ${item.jurisdiction}` : ""}
          </strong>
        </div>
        <div>
          <label>Procedure</label>
          <strong>{label(item.procedureType)}</strong>
        </div>
        <div>
          <label>Local deadline</label>
          <strong>{fmt(item.submissionDueAt, item.localTimezone)}</strong>
        </div>
        <div>
          <label>Normalized deadline</label>
          <strong>{item.submissionDueAt ?? "Not stated"}</strong>
        </div>
        <div>
          <label>Last verified</label>
          <strong>{fmt(item.lastSeenAt)}</strong>
        </div>
        <div>
          <label>Source health</label>
          <Status
            tone={
              item.sourceHealth === "healthy"
                ? "good"
                : item.sourceHealth === "degraded"
                  ? "bad"
                  : "warn"
            }
          >
            {label(item.sourceHealth)}
          </Status>
        </div>
      </section>
      <a
        className="official-link"
        href={item.detailUrl ?? item.sourceUrl}
        target="_blank"
        rel="noreferrer"
      >
        Open official portal <ArrowUpRight size={15} />
      </a>
      <div className="source-note">
        <Database size={17} />
        <div>
          <strong>{source?.name ?? "Unknown source"}</strong>
          <p>
            {item.verification === "last_known_good"
              ? "Latest run failed validation. This opportunity remains pinned to the last accepted version."
              : "Canonical values are backed by preserved raw fields and field-level evidence."}
          </p>
        </div>
      </div>
    </div>
  );
}

function Evidence({ item }: { item: Opportunity }) {
  return (
    <div className="evidence-table">
      <div className="evidence-head">
        <span>Canonical field</span>
        <span>Normalized value</span>
        <span>Raw scraped value</span>
        <span>Observed</span>
        <span>Confidence</span>
        <span>Source</span>
      </div>
      {item.evidence.map((row) => (
        <div className="evidence-row" key={row.id}>
          <strong>{label(row.fieldName)}</strong>
          <code>{String(row.normalizedValue ?? "null")}</code>
          <div>
            <small>{row.rawLabel}</small>
            <code>{row.rawValue ?? "null"}</code>
          </div>
          <span>{fmt(row.observedAt)}</span>
          <Status tone={row.confidence === "high" ? "good" : "warn"}>
            {label(row.confidence)}
          </Status>
          <a
            href={row.sourceUrl}
            target="_blank"
            rel="noreferrer"
            aria-label={`View source for ${row.fieldName}`}
          >
            <ArrowUpRight size={15} />
          </a>
        </div>
      ))}
    </div>
  );
}
function Raw({ item, provenance }: { item: Opportunity; provenance: string }) {
  return (
    <div className="raw-panel">
      <div className="raw-caption">
        <FileJson size={17} />
        <span>Immutable source row</span>
        <Status tone="info">
          {provenance === "postgres"
            ? "Archived source row"
            : provenance === "recorded_live"
              ? "Completed Bright Data run"
              : "No recorded source run"}
        </Status>
      </div>
      <pre>{JSON.stringify(item.raw, null, 2)}</pre>
    </div>
  );
}
function Changes({ item }: { item: Opportunity }) {
  return (
    <div className="changes">
      {item.changes.length === 0 ? (
        <div className="empty">
          <History />
          <h3>No material changes observed</h3>
          <p>This version matches the previous accepted canonical record.</p>
        </div>
      ) : (
        item.changes.map((change) => (
          <article key={change.id}>
            <div>
              <Status
                tone={
                  change.severity === "critical"
                    ? "bad"
                    : change.severity === "high"
                      ? "warn"
                      : "info"
                }
              >
                {label(change.severity)}
              </Status>
              <strong>{label(change.field)}</strong>
              <time>{fmt(change.observedAt)}</time>
            </div>
            <div className="diff">
              <span>
                <small>Previous</small>
                <code>{String(change.oldValue)}</code>
              </span>
              <span>
                <small>Current</small>
                <code>{String(change.newValue)}</code>
              </span>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

type WorkspaceTask = {
  id: string;
  label: string;
  status: "todo" | "done" | "blocked";
};
export function Apply({ item }: { item: Opportunity }) {
  const [status, setStatus] = useState("reviewing");
  const [notes, setNotes] = useState("");
  const [tasks, setTasks] = useState<WorkspaceTask[]>([]);
  const [saveState, setSaveState] = useState("");
  useEffect(() => {
    void fetch(`/api/applications/${encodeURIComponent(item.id)}`)
      .then((response) => response.json())
      .then(
        (workspace: {
          status: string;
          notes: string;
          tasks: WorkspaceTask[];
        }) => {
          setStatus(workspace.status);
          setNotes(workspace.notes);
          setTasks(workspace.tasks);
        },
      );
  }, [item.id]);
  const save = async () => {
    setSaveState("Saving…");
    const response = await fetch(
      `/api/applications/${encodeURIComponent(item.id)}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, notes, tasks }),
      },
    );
    setSaveState(response.ok ? "Saved" : "Save failed");
  };
  return (
    <div className="apply-panel">
      <div className="workspace-head">
        <div>
          <label>Application status</label>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="not_started">Not started</option>
            <option value="reviewing">Reviewing</option>
            <option value="preparing">Preparing</option>
            <option value="ready_for_review">Ready for review</option>
            <option value="submitted_manually">Submitted manually</option>
            <option value="archived">Archived</option>
          </select>
        </div>
        <div className="readiness">
          <Status tone="warn">Review</Status>
          <span>Readiness requires human verification</span>
        </div>
      </div>
      <section>
        <h3>Application checklist</h3>
        {tasks.map((task) => (
          <label className="task" key={task.id}>
            <input
              type="checkbox"
              checked={task.status === "done"}
              onChange={() =>
                setTasks((current) =>
                  current.map((value) =>
                    value.id === task.id
                      ? {
                          ...value,
                          status: value.status === "done" ? "todo" : "done",
                        }
                      : value,
                  ),
                )
              }
            />
            <span>{task.label}</span>
          </label>
        ))}
        <button
          className="text-button"
          onClick={() =>
            setTasks((current) => [
              ...current,
              {
                id: String(Date.now()),
                label: "New preparation task",
                status: "todo",
              },
            ])
          }
        >
          <Plus size={14} />
          Add task
        </button>
        <label>
          Notes
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Private preparation notes…"
          />
        </label>
        <button className="secondary" onClick={save}>
          Save workspace
        </button>
        {saveState && <small className="muted">{saveState}</small>}
      </section>
    </div>
  );
}

function Copilot({ item }: { item: Opportunity }) {
  const [question, setQuestion] = useState("");
  const [models, setModels] = useState<
    Array<{ id: string; mode: "non_reasoning" | "reasoning" }>
  >([]);
  const [model, setModel] = useState("");
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      text: string;
      evidenceFields?: string[];
      recordsSearched?: number;
    }>
  >([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fastModels = models.filter((candidate) => candidate.mode === "non_reasoning");
  const reasoningModels = models.filter((candidate) => candidate.mode === "reasoning");
  useEffect(() => {
    let active = true;
    void fetch("/api/copilot/models")
      .then((response) => response.ok
        ? response.json() as Promise<{ data: typeof models; defaultModel: string }>
        : null)
      .then((body) => {
        if (active && body) {
          setModels(body.data);
          setModel(body.defaultModel);
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, []);
  const ask = async () => {
    const prompt = question.trim();
    if (!prompt || loading) return;
    setLoading(true);
    setError("");
    setQuestion("");
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: prompt },
    ]);
    try {
      const result = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: item.id, question: prompt, model: model || undefined }),
      });
      const body = (await result.json()) as {
        answer?: string;
        evidenceFields?: string[];
        recordsSearched?: number;
        error?: string;
      };
      if (!result.ok || !body.answer)
        throw new Error(body.error ?? "Copilot unavailable");
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text: body.answer ?? "",
          evidenceFields: body.evidenceFields ?? [],
          recordsSearched: body.recordsSearched,
        },
      ]);
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to reach NVIDIA NIM",
      );
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="detail-copilot">
      <div className="detail-copilot-head">
        <div>
          <p className="eyebrow">Opportunity research</p>
          <h3>Ask about this opportunity.</h3>
        </div>
        <button className="secondary" onClick={() => setMessages([])} disabled={loading}>New chat</button>
      </div>
      <section className="detail-copilot-messages" role="log" aria-live="polite">
        {messages.length === 0 && !loading && (
          <p className="detail-copilot-empty">Ask a specific question. SecureContract searches the accepted record set and cites evidence from the selected opportunity.</p>
        )}
        {messages.map((message) => (
          <article key={message.id} className={`detail-copilot-message ${message.role}`}>
            <span>{message.role === "assistant" ? <ShieldCheck size={14} /> : "You"}</span>
            <div>
              <p>{message.text}</p>
              {message.evidenceFields?.length ? <small>Evidence: {message.evidenceFields.map(label).join(", ")}</small> : null}
              {message.recordsSearched !== undefined ? <small>Searched {message.recordsSearched.toLocaleString()} accepted records.</small> : null}
            </div>
          </article>
        ))}
      </section>
      {loading && (
        <LoadingState label="Searching accepted records" progressLabel="Reading opportunity evidence" />
      )}
      {error && (
        <div className="inline-error" role="alert">
          {error}
        </div>
      )}
      <form className="detail-copilot-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
        {models.length > 0 && <select aria-label="Copilot AI model" value={model} onChange={(event) => setModel(event.target.value)} disabled={loading}>
          {fastModels.length > 0 && <optgroup label="Fast / non-reasoning">{fastModels.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}</optgroup>}
          {reasoningModels.length > 0 && <optgroup label="Reasoning / slower">{reasoningModels.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}</optgroup>}
        </select>}
        <textarea value={question} onChange={(event) => setQuestion(event.target.value)} aria-label="Ask SecureContract question" placeholder="Ask a question about this opportunity…" />
        <button className="primary" disabled={loading || !question.trim()} aria-label="Send question">{loading ? <RefreshCw className="spin" size={17} /> : <Send size={17} />}</button>
      </form>
    </div>
  );
}

function ContractAssistant({ items }: { items: Opportunity[] }) {
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<
    Array<{ id: string; mode: "non_reasoning" | "reasoning" }>
  >([]);
  const [model, setModel] = useState("");
  const messageEndRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [messages, setMessages] = useState<
    Array<{
      id: string;
      role: "user" | "assistant";
      text: string;
      ids?: string[];
      searched?: number;
      read?: number;
    }>
  >([]);
  const byId = new Map(items.map((item) => [item.id, item]));
  useEffect(() => {
    let active = true;
    void fetch("/api/copilot/models")
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{
              data: Array<{
                id: string;
                mode: "non_reasoning" | "reasoning";
              }>;
              defaultModel: string;
            }>)
          : null,
      )
      .then((body) => {
        if (active && body) {
          setModels(body.data);
          setModel(body.defaultModel);
        }
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, []);
  const send = async () => {
    const prompt = question.trim();
    if (!prompt || loading) return;
    setQuestion("");
    if (composerRef.current) composerRef.current.style.height = "auto";
    setLoading(true);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "user", text: prompt },
    ]);
    try {
      const response = await fetch("/api/copilot/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: prompt, model: model || undefined }),
      });
      const body = (await response.json()) as {
        answer?: string;
        error?: string;
        opportunityIds?: string[];
        recordsSearched?: number;
        recordsRead?: number;
      };
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          text:
            body.answer ??
            body.error ??
            "The contract search could not answer.",
          ids: body.opportunityIds,
          searched: body.recordsSearched,
          read: body.recordsRead,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };
  const fastModels = models.filter((candidate) => candidate.mode === "non_reasoning");
  const reasoningModels = models.filter((candidate) => candidate.mode === "reasoning");
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages, loading]);
  const resetConversation = () => {
    if (loading) return;
    setQuestion("");
    setMessages([]);
  };
  return (
    <main className="assistant-page">
      <section className="assistant-shell">
        <section className="assistant-chat" aria-busy={loading}>
          <div className="assistant-chat-head">
            <div><p className="eyebrow">Research</p><h1>Ask SecureContract</h1></div>
            <div className="assistant-head-actions">
              <button className="secondary assistant-new" onClick={resetConversation} disabled={loading}><Plus size={15} /> New chat</button>
            </div>
          </div>
          <section className="assistant-messages" role="log" aria-live="polite">
          {messages.length === 0 && !loading && (
            <div className="assistant-welcome">
              <span className="assistant-welcome-mark"><ShieldCheck size={22} /></span>
              <h2>Start with a real procurement question.</h2>
              <p>Search the accepted contract records and open the original sources behind the returned opportunities.</p>
            </div>
          )}
          {messages.map((message) => (
            <article
              key={message.id}
              className={`assistant-message ${message.role}`}
            >
              <span>
                {message.role === "assistant" ? <ShieldCheck size={16} /> : "You"}
              </span>
              <div>
                <p>{message.text}</p>
                {message.ids?.length ? (
                  <div className="assistant-results">
                    {message.ids.map((id) => {
                      const item = byId.get(id);
                      return item ? (
                        <a
                          key={id}
                          href={item.detailUrl ?? item.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <strong>{item.titleOriginal}</strong>
                          <small>
                            {item.buyerOriginal} · {item.countryName} ·{" "}
                            {fmt(item.submissionDueAt, item.localTimezone)}
                          </small>
                          <em>
                            Official source <ArrowUpRight size={12} />
                          </em>
                        </a>
                      ) : null;
                    })}
                  </div>
                ) : null}
                {message.searched !== undefined && (
                  <small className="search-accountability">
                    Searched {message.searched.toLocaleString()} saved contracts
                    · read {message.read} relevant records
                  </small>
                )}
              </div>
            </article>
          ))}
          {loading && (
            <LoadingState label="Reviewing relevant records" progressLabel="Retrieving source evidence" />
          )}
          <div ref={messageEndRef} />
          </section>
          <form
          className="assistant-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void send();
          }}
          >
          {models.length > 0 && (
            <label className="assistant-model">
              <span>Model</span>
              <select aria-label="AI model" value={model} onChange={(event) => setModel(event.target.value)} disabled={loading}>
                {fastModels.length > 0 && <optgroup label="Fast / non-reasoning">{fastModels.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}</optgroup>}
                {reasoningModels.length > 0 && <optgroup label="Reasoning / slower">{reasoningModels.map((option) => <option key={option.id} value={option.id}>{option.id}</option>)}</optgroup>}
              </select>
            </label>
          )}
          <textarea
            ref={composerRef}
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            onInput={(event) => {
              event.currentTarget.style.height = "auto";
              event.currentTarget.style.height = `${Math.min(event.currentTarget.scrollHeight, 180)}px`;
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
            rows={1}
            placeholder="For example: cloud migration contracts in the US over the next 60 days"
          />
          <button
            className="primary"
            disabled={loading || !question.trim()}
            aria-label="Search contracts"
          >
            {loading ? (
              <RefreshCw className="spin" size={18} />
            ) : (
              <Send size={18} />
            )}
          </button>
          </form>
          <p className="assistant-composer-note"><ShieldCheck size={13} /> Search is restricted to the current accepted contract records.</p>
        </section>
      </section>
    </main>
  );
}

function Detail({
  item,
  sources,
  provenance,
  onClose,
  tab,
  setTab,
}: {
  item: Opportunity;
  sources: SourceConfig[];
  provenance: string;
  onClose: () => void;
  tab: DetailTab;
  setTab: (tab: DetailTab) => void;
}) {
  return (
    <aside className="detail">
      <div className="detail-title">
        <div>
          <h2>{item.titleOriginal}</h2>
          <p>
            {item.externalId} · {item.countryName}
            {item.jurisdiction ? ` · ${item.jurisdiction}` : ""}
          </p>
        </div>
        <div className="detail-actions">
          <button className="copilot-launch" onClick={() => setTab("copilot")}>
            <Sparkles size={15} /> Ask copilot
          </button>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close detail"
          >
            <X />
          </button>
        </div>
      </div>
      <div className="detail-meta">
        <div>
          <label>Deadline</label>
          <strong>{fmt(item.submissionDueAt, item.localTimezone)}</strong>
        </div>
        <div>
          <label>Changed</label>
          <strong>
            {item.changes.length ? `${item.changes.length} material` : "None"}
          </strong>
        </div>
        <div>
          <label>Verification</label>
          <strong
            className={item.verification === "verified" ? "verified" : "warn"}
          >
            {label(item.verification)}
          </strong>
        </div>
      </div>
      <div className="tabs">
        {(
          ["summary", "evidence", "changes", "raw", "copilot"] as DetailTab[]
        ).map((value) => (
          <button
            className={tab === value ? "active" : ""}
            onClick={() => setTab(value)}
            key={value}
          >
            {value === "summary" ? "Overview" : label(value)}
            {value === "changes" && item.changes.length > 0 ? (
              <span>{item.changes.length}</span>
            ) : null}
          </button>
        ))}
      </div>
      {tab === "summary" && <Summary item={item} sources={sources} />}{" "}
      {tab === "evidence" && <Evidence item={item} />}{" "}
      {tab === "raw" && <Raw item={item} provenance={provenance} />}{" "}
      {tab === "changes" && <Changes item={item} />}{" "}
      {tab === "copilot" && <Copilot item={item} />}
    </aside>
  );
}

function OpportunitiesView({
  items,
  sources,
  provenance,
  onRefresh,
}: {
  items: Opportunity[];
  sources: SourceView[];
  provenance: string;
  onRefresh: () => Promise<void>;
}) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("open");
  const [sourceId, setSourceId] = useState("all");
  const [buyer, setBuyer] = useState("");
  const [procedure, setProcedure] = useState("all");
  const [verification, setVerification] = useState("all");
  const [changeFilter, setChangeFilter] = useState("all");
  const [dueFrom, setDueFrom] = useState("");
  const [dueTo, setDueTo] = useState("");
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [findingMore, setFindingMore] = useState(false);
  const [findState, setFindState] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [selectedDetail, setSelectedDetail] = useState<Opportunity | null>(
    null,
  );
  const [tab, setTab] = useState<DetailTab>("summary");
  const [detailOpen, setDetailOpen] = useState(false);
  const countries = useMemo(
    () => [
      ...new Map(
        items.map((item) => [item.countryCode, item.countryName]),
      ).entries(),
    ],
    [items],
  );
  const statuses = useMemo(
    () => [...new Set(items.map((item) => item.status))],
    [items],
  );
  const procedures = useMemo(
    () => [...new Set(items.map((item) => item.procedureType))].sort(),
    [items],
  );
  const degraded = sources.find((source) => source.status === "degraded");
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (country === "all" || item.countryCode === country) &&
          (status === "all" || item.status === status) &&
          (sourceId === "all" || item.sourceId === sourceId) &&
          (procedure === "all" || item.procedureType === procedure) &&
          (verification === "all" || item.verification === verification) &&
          (changeFilter === "all" ||
            (changeFilter === "changed" && item.changes.length > 0) ||
            (changeFilter === "critical" &&
              item.changes.some((change) => change.severity === "critical"))) &&
          (!dueFrom ||
            Boolean(
              item.submissionDueAt &&
                item.submissionDueAt.slice(0, 10) >= dueFrom,
            )) &&
          (!dueTo ||
            Boolean(
              item.submissionDueAt &&
                item.submissionDueAt.slice(0, 10) <= dueTo,
            )) &&
          item.buyerOriginal.toLowerCase().includes(buyer.toLowerCase()) &&
          `${item.titleOriginal} ${item.buyerOriginal} ${item.externalId}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [
      items,
      search,
      country,
      status,
      sourceId,
      procedure,
      verification,
      changeFilter,
      dueFrom,
      dueTo,
      buyer,
    ],
  );
  const selected =
    selectedDetail?.id === selectedId
      ? selectedDetail
      : (filtered.find((item) => item.id === selectedId) ?? null);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * pageSize;
  const pageItems = filtered.slice(pageStart, pageStart + pageSize);
  const pageButtons = Array.from(
    {
      length: Math.min(5, pageCount),
    },
    (_, index) => {
      const first = Math.min(
        Math.max(1, currentPage - 2),
        Math.max(1, pageCount - 4),
      );
      return first + index;
    },
  );
  const findMore = async () => {
    setFindingMore(true);
    const publicSources = sources.filter(
      (source) =>
        source.status === "active" &&
        (source.collectionMethod === "public_html" ||
          source.collectionMethod === "public_api"),
    );
    let completed = 0;
    const failures: string[] = [];
    for (const source of publicSources) {
      try {
        await runSourceCollection(source, (state) =>
          setFindState(
            `${completed + 1}/${publicSources.length} · ${source.countryCode} · ${state}`,
          ),
        );
        completed += 1;
      } catch {
        failures.push(source.name);
      }
    }
    await onRefresh();
    setFindState(
      failures.length
        ? `${completed} sources refreshed · ${failures.length} unavailable`
        : `${completed} public sources refreshed`,
    );
    setFindingMore(false);
  };
  if (!items.length)
    return (
      <main>
        <section className="content full">
          <div className="empty">
            <Database />
            <h3>No accepted opportunities yet</h3>
            <p>
              Run and validate a configured source. Failed runs will remain
              archived without entering this feed.
            </p>
          </div>
        </section>
      </main>
    );
  return (
    <main className={detailOpen ? "split" : ""}>
      <section className="content">
        <div className="page-title">
          <div>
            <h1>Opportunities</h1>
            <p>
              Public procurement opportunities with source-level provenance.
            </p>
          </div>
          <div className="page-actions">
            <Status tone="info">
              {provenance === "postgres"
                ? "Validated canonical data"
                : provenance === "recorded_live"
                  ? "Recorded source snapshot"
                  : "Source configuration required"}
            </Status>
            <button
              className="primary"
              disabled={findingMore}
              onClick={() => void findMore()}
            >
              <RefreshCw className={findingMore ? "spin" : ""} size={15} />
              {findingMore
                ? "Searching public sources"
                : "Find more opportunities"}
            </button>
          </div>
        </div>
        <details className="advanced-filters">
          <summary>
            <Filter size={14} /> Advanced filters{" "}
            <span>Buyer · procedure · dates · evidence · changes</span>
          </summary>
          <div className="advanced-filter-grid">
            <label>
              Buyer or agency
              <input
                value={buyer}
              onChange={(event) => {
                setBuyer(event.target.value);
                setPage(1);
              }}
                placeholder="e.g. Transportation"
              />
            </label>
            <label>
              Procedure
              <select
                value={procedure}
                onChange={(event) => setProcedure(event.target.value)}
              >
                <option value="all">All procedures</option>
                {procedures.map((value) => (
                  <option key={value} value={value}>
                    {label(value)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Due from
              <input
                type="date"
                value={dueFrom}
                onChange={(event) => setDueFrom(event.target.value)}
              />
            </label>
            <label>
              Due through
              <input
                type="date"
                value={dueTo}
                onChange={(event) => setDueTo(event.target.value)}
              />
            </label>
            <label>
              Evidence
              <select
                value={verification}
                onChange={(event) => setVerification(event.target.value)}
              >
                <option value="all">Any verification</option>
                <option value="verified">Verified</option>
                <option value="partial">Partial</option>
                <option value="last_known_good">Last known good</option>
              </select>
            </label>
            <label>
              Changes
              <select
                value={changeFilter}
                onChange={(event) => setChangeFilter(event.target.value)}
              >
                <option value="all">Any change state</option>
                <option value="changed">Has changes</option>
                <option value="critical">Critical changes</option>
              </select>
            </label>
            <button
              className="text-button"
              onClick={() => {
                setPage(1);
                setBuyer("");
                setProcedure("all");
                setDueFrom("");
                setDueTo("");
                setVerification("all");
                setChangeFilter("all");
              }}
            >
              Clear advanced filters
            </button>
          </div>
        </details>
        <div className="toolbar">
          <label className="search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search opportunities or buyers…"
            />
          </label>
          <div className="filter">
            <Filter size={15} />
            <select
              value={country}
              onChange={(event) => {
                setCountry(event.target.value);
                setPage(1);
              }}
              aria-label="Country filter"
            >
              <option value="all">All countries</option>
              {countries.map(([code, name]) => (
                <option value={code} key={code}>
                  {name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="filter">
            <select
              value={sourceId}
              onChange={(event) => {
                setSourceId(event.target.value);
                setPage(1);
              }}
              aria-label="Source filter"
            >
              <option value="all">All sources</option>
              {sources.map((source) => (
                <option value={source.id} key={source.id}>
                  {source.name}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
          <div className="filter">
            <select
              value={status}
              onChange={(event) => {
                setStatus(event.target.value);
                setPage(1);
              }}
              aria-label="Status filter"
            >
              <option value="all">All statuses</option>
              {statuses.map((value) => (
                <option value={value} key={value}>
                  {label(value)}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
        {degraded && (
          <div className="warning-banner">
            <AlertTriangle size={18} />
            <div>
              <strong>{degraded.name} is degraded.</strong> Latest results
              failed validation; preserved last-known-good opportunities remain
              visible.
            </div>
            <button
              onClick={() => {
                setSourceId(degraded.id);
                setCountry("all");
              }}
            >
              View affected source
            </button>
          </div>
        )}
        <div className="result-count">
          <strong>{filtered.length}</strong> opportunities{" "}
          <span>
            ·{" "}
            {provenance === "postgres"
              ? "Only accepted runs are published"
              : provenance === "recorded_live"
                ? "Recorded source snapshot"
                : "Connect authorised sources to publish accepted records"}
          </span>
          {findState && <small>{findState}</small>}
        </div>
        <OpportunityTable
          items={pageItems}
          selected={selected}
          onSelect={(item) => {
            setSelectedId(item.id);
            setSelectedDetail(null);
            setDetailOpen(true);
            void fetch(`/api/opportunities/${encodeURIComponent(item.id)}`)
              .then((response) => response.json())
              .then((body: { data?: Opportunity }) => {
                if (body.data) setSelectedDetail(body.data);
              });
          }}
        />
        <div className="result-pagination">
          <label>
            Show
            <select
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              aria-label="Results per page"
            >
              {[5, 10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
            per page
          </label>
          <span>
            {filtered.length
              ? `${pageStart + 1}–${Math.min(pageStart + pageSize, filtered.length)} of ${filtered.length.toLocaleString()}`
              : "0 results"}
          </span>
          <nav aria-label="Opportunity pages">
            <button
              className="secondary"
              disabled={currentPage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Previous
            </button>
            {pageButtons.map((pageNumber) => (
              <button
                key={pageNumber}
                className={pageNumber === currentPage ? "page-current" : "page-number"}
                aria-current={pageNumber === currentPage ? "page" : undefined}
                onClick={() => setPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
            <button
              className="secondary"
              disabled={currentPage === pageCount}
              onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            >
              Next
            </button>
          </nav>
        </div>
      </section>
      {detailOpen && selected && (
        <Detail
          item={selected}
          sources={sources}
          provenance={provenance}
          tab={tab}
          setTab={setTab}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </main>
  );
}

async function runSourceCollection(
  source: SourceConfig,
  onState: (state: string) => void,
) {
  onState("Starting collector…");
  const trigger = await fetch(`/api/runs/${encodeURIComponent(source.id)}`, {
    method: "POST",
    credentials: "include",
  });
  const triggerBody = (await trigger.json()) as {
    collectionId?: string;
    error?: string;
    run?: { validRowCount: number; rowCount: number; status: string };
  };
  if (!trigger.ok)
    throw new Error(triggerBody.error ?? "Collection trigger failed");
  if (triggerBody.run) {
    onState(
      `${triggerBody.run.validRowCount}/${triggerBody.run.rowCount} rows accepted`,
    );
    return;
  }
  if (!triggerBody.collectionId)
    throw new Error("Collection started without a snapshot ID");
  onState(`Bright Data snapshot ${triggerBody.collectionId}`);
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    const poll = await fetch(
      `/api/runs/poll/${encodeURIComponent(triggerBody.collectionId)}`,
      {
        credentials: "include",
      },
    );
    const body = (await poll.json()) as {
      error?: string;
      run?: { validRowCount: number; rowCount: number; status: string };
    };
    if (poll.status === 202) {
      onState(`Collecting · ${attempt + 1}`);
      continue;
    }
    if (!poll.ok) throw new Error(body.error ?? "Collection polling failed");
    onState(
      body.run
        ? `${body.run.validRowCount}/${body.run.rowCount} rows accepted`
        : "Validated",
    );
    return;
  }
  throw new Error(
    "Collection is still running. Retry shortly to see the latest run.",
  );
}

function RunSource({
  source,
  onComplete,
}: {
  source: SourceConfig;
  onComplete: () => Promise<void>;
}) {
  const [state, setState] = useState("");
  const [running, setRunning] = useState(false);
  const unavailable =
    source.collectionMethod !== "bright_data" && source.status !== "active";
  const run = async () => {
    setRunning(true);
    try {
      await runSourceCollection(source, setState);
      await onComplete();
    } catch (error) {
      setState(error instanceof Error ? error.message : "Collection failed");
    } finally {
      setRunning(false);
    }
  };
  return (
    <div className="run-control">
      <button
        className="secondary"
        disabled={
          unavailable ||
          (!source.collectorId && source.collectionMethod === "bright_data") ||
          running
        }
        onClick={() => void run()}
      >
        <RefreshCw className={running ? "spin" : ""} size={14} />
        {running
          ? "Running"
          : unavailable
            ? "Source unavailable"
            : source.publishToOpportunityFeed === false
              ? "Refresh index"
              : "Run collector"}
      </button>
      {state && (
        <small
          className={state.includes("failed") ? "inline-error" : "run-state"}
        >
          {state}
        </small>
      )}
    </div>
  );
}

function SourcesView({
  sources,
  onRefresh,
}: {
  sources: SourceView[];
  onRefresh: () => Promise<void>;
}) {
  const [healing, setHealing] = useState<HealingRecord[]>([]);
  const [refreshState, setRefreshState] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const loadHealing = async () => {
    const ledger = (await fetch("/api/healing").then((response) =>
      response.json(),
    )) as { data: HealingRecord[] };
    setHealing(ledger.data);
  };
  useEffect(() => {
    const task = window.setTimeout(() => void loadHealing(), 0);
    return () => window.clearTimeout(task);
  }, []);
  const refreshAll = async () => {
    const active = sources.filter(
      (source) =>
        source.status === "active" &&
        source.publishToOpportunityFeed !== false &&
        (source.collectionMethod !== "bright_data" ||
          Boolean(source.collectorId)),
    );
    const ordered = [...active].sort((left, right) =>
      left.collectionMethod !== "bright_data" &&
      right.collectionMethod === "bright_data"
        ? -1
        : 1,
    );
    setRefreshing(true);
    try {
      for (const [index, source] of ordered.entries()) {
        await runSourceCollection(source, (state) =>
          setRefreshState(
            `${index + 1}/${ordered.length} · ${source.countryCode} · ${state}`,
          ),
        );
      }
      setRefreshState(`${active.length} collectors refreshed`);
      await onRefresh();
    } catch (error) {
      setRefreshState(
        error instanceof Error ? error.message : "Refresh failed",
      );
    } finally {
      setRefreshing(false);
    }
  };
  return (
    <main>
      <section className="content full">
        <div className="page-title">
          <div>
            <p className="eyebrow">Live collection</p>
            <h1>Sources</h1>
            <p>
              Refresh every public feed, then publish only rows that pass
              validation.
            </p>
          </div>
          <button
            className="primary run-all"
            disabled={refreshing}
            onClick={() => void refreshAll()}
          >
            <RefreshCw className={refreshing ? "spin" : ""} size={15} />
            {refreshing ? "Running live sources" : "Run all live sources"}
          </button>
        </div>
        {refreshState && <p className="run-state operations-state">{refreshState}</p>}
        <div className="section-heading">
          <div>
            <p className="eyebrow">Current coverage</p>
            <h2>Live feeds</h2>
          </div>
          <span className="ledger-note">US · Canada · Australia · India</span>
        </div>
        <div className="source-list">
          {sources.map((source) => (
            <article key={source.id}>
              <div className="source-main">
                <div className="source-icon">
                  <Database />
                </div>
                <div>
                  <div className="source-title-line">
                    <h2>{source.name}</h2>
                    <Status
                      tone={
                        source.status === "active"
                          ? "good"
                          : source.status === "degraded"
                            ? "bad"
                            : "warn"
                      }
                    >
                      {source.status === "active"
                        ? "Healthy"
                        : label(source.status)}
                    </Status>
                  </div>
                  <p>
                    {source.countryName}
                    {source.jurisdictionName
                      ? ` · ${source.jurisdictionName}`
                      : ""}{" "}
                    · {source.jurisdictionType}
                  </p>
                  <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                    {new URL(source.sourceUrl).hostname}
                    <ArrowUpRight size={13} />
                  </a>
                </div>
              </div>
              <div>
                <label>Latest result</label>
                <strong>
                  {source.latestRun
                    ? `${source.latestRun.rowCount} rows · ${source.latestRun.validRowCount} valid`
                    : source.collectorId
                      ? "Collector ready · no accepted run"
                      : "Collector not configured"}
                </strong>
              </div>
              <RunSource source={source} onComplete={onRefresh} />
            </article>
          ))}
        </div>
        <details className="repair-drawer">
          <summary>
            <span>
              <Wrench size={15} /> {healing.length} verified scraper repairs
            </span>
            <small>View the self-healing evidence</small>
          </summary>
          <div className="healing-grid">
            {healing.map((record) => (
              <article key={record.collectorId}>
                <header>
                  <div>
                    <p className="eyebrow">{record.collectorId}</p>
                    <h3>{record.sourceName}</h3>
                  </div>
                  <Status tone={record.status === "verified" ? "good" : "warn"}>
                    {label(record.status)}
                  </Status>
                </header>
                <ol>
                  <li>
                    <span>01</span>
                    <div>
                      <strong>Detected</strong>
                      <p>{record.detected}</p>
                    </div>
                  </li>
                  <li>
                    <span>02</span>
                    <div>
                      <strong>Repair</strong>
                      <p>{record.repair}</p>
                    </div>
                  </li>
                  <li>
                    <span>03</span>
                    <div>
                      <strong>Outcome</strong>
                      <p>{record.outcome}</p>
                    </div>
                  </li>
                </ol>
                <footer>
                  <span>
                    <Check size={13} /> Same Collector ID
                  </span>
                  <span>
                    <Check size={13} /> Reviewed
                  </span>
                </footer>
              </article>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}
export default function App() {
  const [view, setView] = useState<View>("landing");
  const [items, setItems] = useState<Opportunity[]>([]);
  const [sources, setSources] = useState<SourceView[]>([]);
  const [provenance, setProvenance] = useState("loading");
  const [error, setError] = useState("");
  const loadData = useCallback(async () => {
    try {
      const [opportunityResponse, sourceResponse] = await Promise.all([
        fetch("/api/opportunities").then((response) =>
          response.json(),
        ) as Promise<{ data: Opportunity[]; provenance: string }>,
        fetch("/api/sources").then((response) => response.json()) as Promise<{
          data: SourceView[];
        }>,
      ]);
      setItems(opportunityResponse.data);
      setSources(sourceResponse.data);
      setProvenance(opportunityResponse.provenance);
      setError("");
    } catch {
      setError("SecureContract could not load its data API.");
      setProvenance("unavailable");
    }
  }, []);
  useEffect(() => {
    const task = window.setTimeout(() => void loadData(), 0);
    return () => window.clearTimeout(task);
  }, [loadData]);
  if (provenance === "loading" && view !== "landing")
    return (
      <>
        <Header view={view} setView={setView} provenance={provenance} />
        <main>
          <section className="content full">
            <div className="empty">
              <Database />
              <h3>Loading trusted opportunities…</h3>
              <p>Checking the accepted canonical dataset and source health.</p>
            </div>
          </section>
        </main>
      </>
    );
  if (error && view !== "landing")
    return (
      <>
        <Header view={view} setView={setView} provenance={provenance} />
        <main>
          <section className="content full">
            <div className="empty">
              <AlertTriangle />
              <h3>Data API unavailable</h3>
              <p>{error}</p>
            </div>
          </section>
        </main>
      </>
    );
  return (
    <>
      <Header view={view} setView={setView} provenance={provenance} />
      {view === "landing" ? (
        <LandingPage
          onStart={() => setView("opportunities")}
          onAssistant={() => setView("assistant")}
          opportunityCount={items.length}
          sourceCount={sources.length}
          featured={items.find((item) => item.status === "open") ?? items[0] ?? null}
        />
      ) : view === "sources" ? (
        <SourcesView sources={sources} onRefresh={loadData} />
      ) : view === "assistant" ? (
        <ContractAssistant items={items} />
      ) : (
        <OpportunitiesView
          key={`${view}-${provenance}`}
          items={items}
          sources={sources}
          provenance={provenance}
          onRefresh={loadData}
        />
      )}
    </>
  );
}
