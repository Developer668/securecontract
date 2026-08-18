import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowUpRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDot,
  Database,
  FileJson,
  Filter,
  History,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Wrench,
  X,
} from "lucide-react";
import type { Opportunity, SourceConfig } from "./types";

type View = "opportunities" | "sources" | "application";
type DetailTab =
  | "summary"
  | "evidence"
  | "raw"
  | "changes"
  | "workspace"
  | "copilot";
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
type ServiceState = {
  brightDataConfigured: boolean;
  nvidiaConfigured: boolean;
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

function Brand() {
  return (
    <div className="brand">
      <span className="brand-mark">
        <ShieldCheck size={21} />
      </span>
      <span>SecureContract</span>
    </div>
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
  const mode =
    provenance === "postgres"
      ? "Persistence-backed"
      : provenance === "recorded_live"
        ? "Recorded live run"
        : "Demonstration mode";
  const navigation: Array<[View, string]> = [
    ["opportunities", "Discover"],
    ["sources", "Operations"],
    ["application", "Workspace"],
  ];
  return (
    <header>
      <Brand />
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
      <div className="avatar">AD</div>
    </header>
  );
}

function OpportunityTable({
  items,
  selected,
  onSelect,
}: {
  items: Opportunity[];
  selected: Opportunity;
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
              className={selected.id === item.id ? "selected" : ""}
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
              : "Demonstration fixture"}
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
function Apply({ item }: { item: Opportunity }) {
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
  const [question, setQuestion] = useState("What should I verify before deciding whether to apply?");
  const [response, setResponse] = useState<{
    answer: string;
    evidenceFields: string[];
    draft: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const ask = async () => {
    setLoading(true);
    setError("");
    try {
      const result = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opportunityId: item.id, question }),
      });
      const body = (await result.json()) as {
        answer?: string;
        evidenceFields?: string[];
        draft?: boolean;
        error?: string;
      };
      if (!result.ok || !body.answer) throw new Error(body.error ?? "Copilot unavailable");
      setResponse({
        answer: body.answer,
        evidenceFields: body.evidenceFields ?? [],
        draft: body.draft ?? true,
      });
    } catch (caught) {
      setResponse(null);
      setError(caught instanceof Error ? caught.message : "Unable to reach NVIDIA NIM");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="copilot-studio">
      <section className="copilot-intro">
        <span className="copilot-orb"><Sparkles size={20} /></span>
        <div>
          <p className="eyebrow">NVIDIA NIM · evidence mode</p>
          <h3>Reason over this opportunity—not the open web.</h3>
          <p>The copilot can interpret collected facts and identify gaps. It cannot invent requirements or decide eligibility.</p>
        </div>
      </section>
      <div className="evidence-scope">
        <span>Evidence in scope</span>
        {item.evidence.map((evidence) => (
          <code key={evidence.id}>{label(evidence.fieldName)}</code>
        ))}
      </div>
      <div className="prompt-library">
        {[
          "Summarize the deadline and status.",
          "What information is missing?",
          "Create a verification checklist.",
        ].map((value) => (
          <button key={value} onClick={() => setQuestion(value)}>{value}</button>
        ))}
      </div>
      <label className="copilot-composer">
        <textarea
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          aria-label="Ask SecureContract question"
          placeholder="Ask about deadlines, status, evidence, or missing requirements…"
        />
        <button disabled={loading || !question.trim()} onClick={() => void ask()} aria-label="Send question">
          {loading ? <RefreshCw className="spin" size={18} /> : <Send size={18} />}
        </button>
      </label>
      {loading && (
        <div className="copilot-thinking">
          <span /><span /><span /> Checking the evidence boundary…
        </div>
      )}
      {error && <div className="inline-error" role="alert">{error}</div>}
      {response && (
        <article className="copilot-response">
          <div className="response-head">
            <span><Bot size={17} /> SecureContract</span>
            <Status tone="warn">Draft · verify</Status>
          </div>
          <p>{response.answer}</p>
          <footer>
            <span>Evidence cited</span>
            {response.evidenceFields.map((field) => <code key={field}>{label(field)}</code>)}
          </footer>
        </article>
      )}
    </div>
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
          <button className="icon-button" onClick={onClose} aria-label="Close detail"><X /></button>
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
          ["summary", "evidence", "changes", "raw", "workspace", "copilot"] as DetailTab[]
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
      {tab === "workspace" && <Apply item={item} />}
      {tab === "copilot" && <Copilot item={item} />}
    </aside>
  );
}

function OpportunitiesView({
  openApplication,
  items,
  sources,
  provenance,
}: {
  openApplication: boolean;
  items: Opportunity[];
  sources: SourceConfig[];
  provenance: string;
}) {
  const [search, setSearch] = useState("");
  const [country, setCountry] = useState("all");
  const [status, setStatus] = useState("all");
  const [sourceId, setSourceId] = useState("all");
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? "");
  const [tab, setTab] = useState<DetailTab>(
    openApplication ? "workspace" : "summary",
  );
  const [detailOpen, setDetailOpen] = useState(true);
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
  const selected = items.find((item) => item.id === selectedId) ?? items[0];
  const degraded = sources.find((source) => source.status === "degraded");
  const filtered = useMemo(
    () =>
      items.filter(
        (item) =>
          (country === "all" || item.countryCode === country) &&
          (status === "all" || item.status === status) &&
          (sourceId === "all" || item.sourceId === sourceId) &&
          `${item.titleOriginal} ${item.buyerOriginal} ${item.externalId}`
            .toLowerCase()
            .includes(search.toLowerCase()),
      ),
    [items, search, country, status, sourceId],
  );
  if (!selected)
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
            <h1>{openApplication ? "Application" : "Opportunities"}</h1>
            <p>
              {openApplication
                ? "Prepare a response with verified facts and visible gaps."
                : "Public procurement opportunities with source-level provenance."}
            </p>
          </div>
          <Status tone="info">
            {provenance === "postgres"
              ? "Validated canonical data"
              : provenance === "recorded_live"
                ? "Recorded live run · timestamped"
                : "Demonstration fixtures · not live"}
          </Status>
        </div>
        <div className="toolbar">
          <label className="search">
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search opportunities or buyers…"
            />
          </label>
          <div className="filter">
            <Filter size={15} />
            <select
              value={country}
              onChange={(event) => setCountry(event.target.value)}
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
              onChange={(event) => setSourceId(event.target.value)}
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
              onChange={(event) => setStatus(event.target.value)}
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
                ? "Replayed from completed live scraper runs"
                : "Data shown is a clearly labeled product demonstration"}
          </span>
        </div>
        <OpportunityTable
          items={filtered}
          selected={selected}
          onSelect={(item) => {
            setSelectedId(item.id);
            setDetailOpen(true);
          }}
        />
      </section>
      {detailOpen && (
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
    onState(`${triggerBody.run.validRowCount}/${triggerBody.run.rowCount} rows accepted`);
    return;
  }
  if (!triggerBody.collectionId)
    throw new Error("Collection started without a snapshot ID");
  onState(`Bright Data snapshot ${triggerBody.collectionId}`);
  for (let attempt = 0; attempt < 90; attempt += 1) {
    await new Promise((resolve) => window.setTimeout(resolve, 2_000));
    const poll = await fetch(`/api/runs/poll/${encodeURIComponent(triggerBody.collectionId)}`, {
      credentials: "include",
    });
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
  throw new Error("Collection is still running. Retry shortly to see the latest run.");
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
        disabled={(!source.collectorId && source.collectionMethod !== "public_html") || running}
        onClick={() => void run()}
      >
        <RefreshCw className={running ? "spin" : ""} size={14} />
        {running ? "Running" : source.publishToOpportunityFeed === false ? "Refresh index" : "Run collector"}
      </button>
      {state && <small className={state.includes("failed") ? "inline-error" : "run-state"}>{state}</small>}
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
  const [serviceState, setServiceState] = useState<ServiceState>({
    brightDataConfigured: false,
    nvidiaConfigured: false,
  });
  const [healing, setHealing] = useState<HealingRecord[]>([]);
  const [refreshState, setRefreshState] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const loadLiveState = async () => {
    const [health, ledger] = await Promise.all([
      fetch("/api/health").then((response) => response.json()) as Promise<ServiceState>,
      fetch("/api/healing").then((response) => response.json()) as Promise<{ data: HealingRecord[] }>,
    ]);
    setServiceState(health);
    setHealing(ledger.data);
  };
  useEffect(() => {
    const task = window.setTimeout(() => void loadLiveState(), 0);
    return () => window.clearTimeout(task);
  }, []);
  const refreshAll = async () => {
    const active = sources.filter(
      (source) =>
        source.status === "active" &&
        source.publishToOpportunityFeed !== false &&
        (source.collectionMethod === "public_html" || Boolean(source.collectorId)),
    );
    const ordered = [...active].sort((left, right) =>
      left.collectionMethod === "public_html" && right.collectionMethod !== "public_html" ? -1 : 1,
    );
    setRefreshing(true);
    try {
      for (const [index, source] of ordered.entries()) {
        await runSourceCollection(source, (state) =>
          setRefreshState(`${index + 1}/${ordered.length} · ${source.countryCode} · ${state}`),
        );
      }
      setRefreshState(`${active.length} collectors refreshed`);
      await onRefresh();
    } catch (error) {
      setRefreshState(error instanceof Error ? error.message : "Refresh failed");
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
            <p>Refresh every public feed, then publish only rows that pass validation.</p>
          </div>
          <button className="primary run-all" disabled={refreshing} onClick={() => void refreshAll()}>
            <RefreshCw className={refreshing ? "spin" : ""} size={15} />
            {refreshing ? "Running live sources" : "Run all live sources"}
          </button>
        </div>
        <section className="connection-strip" aria-label="Live configuration">
          <div><span className={`connection-dot ${serviceState.brightDataConfigured ? "online" : ""}`} /> Bright Data</div>
          <div><span className="connection-dot online" /> Public-page scrapers</div>
          <div><span className={`connection-dot ${serviceState.nvidiaConfigured ? "online" : ""}`} /> NVIDIA NIM</div>
          <strong>{refreshState || `${sources.filter((source) => source.status === "active").length} sources ready`}</strong>
        </section>
        <div className="section-heading">
          <div><p className="eyebrow">Current coverage</p><h2>Live feeds</h2></div>
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
                  <div className="source-title-line"><h2>{source.name}</h2><Status tone={source.status === "active" ? "good" : source.status === "degraded" ? "bad" : "warn"}>{source.status === "active" ? "Healthy" : label(source.status)}</Status></div>
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
          <summary><span><Wrench size={15} /> {healing.length} verified scraper repairs</span><small>View the self-healing evidence</small></summary>
          <div className="healing-grid">
            {healing.map((record) => (
              <article key={record.collectorId}>
                <header><div><p className="eyebrow">{record.collectorId}</p><h3>{record.sourceName}</h3></div><Status tone={record.status === "verified" ? "good" : "warn"}>{label(record.status)}</Status></header>
                <ol>
                  <li><span>01</span><div><strong>Detected</strong><p>{record.detected}</p></div></li>
                  <li><span>02</span><div><strong>Repair</strong><p>{record.repair}</p></div></li>
                  <li><span>03</span><div><strong>Outcome</strong><p>{record.outcome}</p></div></li>
                </ol>
                <footer><span><Check size={13} /> Same Collector ID</span><span><Check size={13} /> Reviewed</span></footer>
              </article>
            ))}
          </div>
        </details>
      </section>
    </main>
  );
}
export default function App() {
  const [view, setView] = useState<View>("opportunities");
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
  if (provenance === "loading")
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
  if (error)
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
      {view === "sources" ? (
        <SourcesView sources={sources} onRefresh={loadData} />
      ) : (
        <OpportunitiesView
          key={`${view}-${provenance}`}
          items={items}
          sources={sources}
          provenance={provenance}
          openApplication={view === "application"}
        />
      )}
    </>
  );
}
