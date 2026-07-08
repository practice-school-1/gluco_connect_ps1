import { useEffect, useState } from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, ResponsiveContainer } from "recharts";
import { API_BASE, api, getToken } from "../../lib/api";
import { Alert, Badge, Button, Card, Empty, Input, Loader, Select, StatCard, Textarea, glucoseBadge, fmtDate, fmtDateTime } from "../../components/ui";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "glucose", label: "Glucose" },
  { id: "meals", label: "Meals" },
  { id: "activity", label: "Activity" },
  { id: "report", label: "Report" },
  { id: "notes", label: "Notes" },
];

export default function PatientDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const [tab, setTab] = useState("overview");
  const [name, setName] = useState(state?.name || "");
  const [diabetesType, setDiabetesType] = useState(state?.diabetesType || "");

  useEffect(() => {
    if (name) return;
    api("GET", "/doctors/patients")
      .then((list) => {
        const p = (list || []).find((x) => x.id === id);
        if (p) {
          setName(p.full_name);
          setDiabetesType(p.diabetes_type);
        }
      })
      .catch(() => {});
  }, [id, name]);

  function exportCsv() {
    const url = `${API_BASE}/export/patient-report?patient_id=${id}&days=30&token=${getToken()}`;
    window.open(url, "_blank");
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <Button variant="secondary" size="sm" onClick={() => navigate("/doctor/patients")}>← Back</Button>
        <h2 className="text-lg font-extrabold tracking-tight">{name || "Patient"}</h2>
        {diabetesType && <Badge tone="blu">{diabetesType.replace(/_/g, " ")}</Badge>}
        <Button variant="secondary" size="sm" className="ml-auto" onClick={exportCsv}>⬇ Export CSV</Button>
      </div>

      <div className="flex gap-1 border-b border-b1 mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2.5 text-sm whitespace-nowrap border-b-2 transition ${
              tab === t.id ? "text-acc border-acc font-semibold" : "text-t3 border-transparent hover:text-t1"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && <OverviewTab patientId={id} />}
      {tab === "glucose" && <GlucoseTab patientId={id} />}
      {tab === "meals" && <MealsTab patientId={id} />}
      {tab === "activity" && <ActivityTab patientId={id} />}
      {tab === "report" && <ReportTab patientId={id} />}
      {tab === "notes" && <NotesTab patientId={id} />}
    </div>
  );
}

function OverviewTab({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api("GET", `/reports/pre-visit/${patientId}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <Loader />;
  if (error) return <Alert>{error}</Alert>;

  const gs = data?.glucose_summary_30d || {};
  const meds = data?.active_medications || [];
  const alerts = data?.recent_alerts || [];
  const notes = data?.recent_notes || data?.doctor_notes || [];

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Avg glucose (30d)" value={gs._avg?.value_mg_dl ? Math.round(gs._avg.value_mg_dl) : "—"} unit="mg/dL" tone="b" />
        <StatCard label="Readings (30d)" value={gs._count?._all ?? "—"} unit="logged" tone="g" />
        <StatCard label="Meals logged (30d)" value={data?.meals_logged_30d ?? "—"} unit="meals" tone="y" />
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <Card title="Active medications">
          {meds.length === 0 ? (
            <span className="text-t3 text-sm">None</span>
          ) : (
            meds.map((m, i) => (
              <div key={i} className="py-1.5 border-b border-b1 last:border-0 text-sm">
                <strong className="text-t1">{m.name}</strong> <span className="text-t2">{m.dosage || ""}</span>{" "}
                <span className="text-t3">— {m.frequency || "—"}</span>
              </div>
            ))
          )}
        </Card>
        <Card title="Active alerts">
          {alerts.length === 0 ? (
            <span className="text-t3 text-sm">None</span>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {alerts.map((a, i) => (
                <Badge key={i} tone="red">{(a.type || "").replace(/_/g, " ")}</Badge>
              ))}
            </div>
          )}
        </Card>
      </div>
      <Card title="Recent notes" className="mt-4">
        {notes.length === 0 ? (
          <span className="text-t3 text-sm">None</span>
        ) : (
          <div className="space-y-2">
            {notes.map((n, i) => (
              <div key={i} className="bg-s2 border border-b1 rounded-lg px-3.5 py-3">
                <div className="text-[11px] text-t3 mb-1">{fmtDateTime(n.created_at)}</div>
                <div className="text-[13px] text-t2 leading-relaxed">{n.content || ""}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

function GlucoseTab({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState([]);
  const [history, setHistory] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api("GET", `/glucose?patient_id=${patientId}`),
      api("GET", `/glucose/history?days=30&patient_id=${patientId}`),
    ]).then(([data, hist]) => {
      setReadings(data.status === "fulfilled" ? data.value || [] : []);
      setHistory(hist.status === "fulfilled" ? hist.value || [] : []);
      setLoading(false);
    });
  }, [patientId]);

  if (loading) return <Loader />;

  const chartData = history.map((d) => ({
    date: d.date ? new Date(d.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "",
    min: d.min ?? null,
    avg: d.avg_glucose ?? null,
    max: d.max ?? null,
  }));

  return (
    <div>
      <Card title="30-day glucose trend" className="mb-4">
        {chartData.length === 0 ? (
          <Empty>No glucose history</Empty>
        ) : (
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#8b8f98", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, "auto"]} tick={{ fill: "#8b8f98", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11, color: "#52525b" }} />
                <ReferenceLine y={70} stroke="#b45309" strokeDasharray="4 3" />
                <ReferenceLine y={140} stroke="#b45309" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="max" stroke="#b91c1c" strokeWidth={1} dot={false} strokeDasharray="4 3" />
                <Line type="monotone" dataKey="avg" stroke="#2a78d6" strokeWidth={2.5} dot={{ r: 3, fill: "#2a78d6" }} />
                <Line type="monotone" dataKey="min" stroke="#15803d" strokeWidth={1} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
      <Card>
        {readings.length === 0 ? (
          <Empty>No readings</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-s2">
                  {["Value", "Type", "Date & time", "Notes"].map((h) => (
                    <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-t3 border-b border-b1">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {readings.map((r, i) => (
                  <tr key={i} className="hover:bg-s2">
                    <td className="px-3.5 py-2.5 border-b border-b1">{glucoseBadge(r.value_mg_dl)}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2 capitalize">{(r.reading_type || "—").replace(/_/g, " ")}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{fmtDateTime(r.recorded_at || r.created_at)}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{r.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function MealsTab({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [meals, setMeals] = useState([]);

  useEffect(() => {
    setLoading(true);
    api("GET", `/meals?patient_id=${patientId}`)
      .then((d) => setMeals(d || []))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <Loader />;

  return (
    <Card>
      {meals.length === 0 ? (
        <Empty>No meals</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-s2">
                {["Type", "Description", "Carbs", "Date & time"].map((h) => (
                  <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-t3 border-b border-b1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {meals.map((m, i) => (
                <tr key={i} className="hover:bg-s2">
                  <td className="px-3.5 py-2.5 border-b border-b1"><Badge tone="blu">{m.meal_type || "—"}</Badge></td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t1">
                    {(m.meal_items?.length ? m.meal_items.map((it) => it.name).join(", ") : m.notes) || "—"}
                  </td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.total_carbs_grams ?? "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{fmtDateTime(m.logged_at || m.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ActivityTab({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    setLoading(true);
    api("GET", `/activities?patient_id=${patientId}`)
      .then((d) => setActivities(d || []))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <Loader />;

  return (
    <Card>
      {activities.length === 0 ? (
        <Empty>No activities</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-s2">
                {["Type", "Steps", "Duration", "Intensity", "Date"].map((h) => (
                  <th key={h} className="text-left px-3.5 py-2.5 text-[10px] font-bold uppercase tracking-wider text-t3 border-b border-b1">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activities.map((a, i) => (
                <tr key={i} className="hover:bg-s2">
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t1">{a.activity_type || "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{a.steps ?? "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{a.active_minutes ? `${a.active_minutes} min` : "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{a.intensity || "—"}</td>
                  <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{fmtDate(a.date || a.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function ReportTab({ patientId }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    api("GET", `/reports/weekly/${patientId}`)
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [patientId]);

  if (loading) return <Loader />;
  if (error) return <Alert tone="warn">{error}</Alert>;

  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <StatCard label="Avg glucose" value={data?.avg_glucose ?? "—"} unit="mg/dL" tone="b" />
        <StatCard label="Time in range" value={data?.time_in_range_pct != null ? `${data.time_in_range_pct}%` : "—"} unit="70–140 mg/dL" tone="g" />
        <StatCard label="Avg daily steps" value={data?.avg_daily_steps ?? "—"} unit="steps" tone="y" />
      </div>
      <Card title="Active medications">
        {(data?.active_medications || []).length === 0 ? (
          <span className="text-t3 text-sm">None</span>
        ) : (
          data.active_medications.map((m, i) => (
            <div key={i} className="py-2 border-b border-b1 last:border-0 text-sm">
              <strong className="text-t1">{m.name}</strong> <span className="text-t2">{m.dosage || ""}</span>{" "}
              <span className="text-t3">{m.frequency || ""}</span>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function NotesTab({ patientId }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState("");
  const [noteType, setNoteType] = useState("clinical");
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ tone: "error", text: "" });

  function load() {
    setLoading(true);
    api("GET", "/notes")
      .then((d) => setNotes((d || []).filter((n) => n.patient_id === patientId)))
      .finally(() => setLoading(false));
  }

  useEffect(load, [patientId]);

  async function addNote() {
    if (!content.trim()) {
      setAlertMsg({ tone: "error", text: "Enter note content." });
      return;
    }
    setSaving(true);
    setAlertMsg({ tone: "error", text: "" });
    try {
      await api("POST", "/notes", { patient_id: patientId, content, note_type: noteType, is_visible_to_patient: visible });
      setAlertMsg({ tone: "success", text: "✓ Note saved!" });
      setContent("");
      load();
    } catch (e) {
      setAlertMsg({ tone: "error", text: e.message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <Card className="max-w-xl">
        <Alert tone={alertMsg.tone}>{alertMsg.text}</Alert>
        <Select label="Note type" value={noteType} onChange={(e) => setNoteType(e.target.value)} className="mb-4">
          <option value="clinical">Clinical observation</option>
          <option value="prescription">Prescription change</option>
          <option value="followup">Follow-up plan</option>
          <option value="general">General</option>
        </Select>
        <Textarea
          label="Content *"
          className="mb-4"
          style={{ minHeight: 120 }}
          placeholder="Write your clinical note…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
        <label className="flex items-center gap-2 text-[13px] text-t2 cursor-pointer mb-4">
          <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="accent-acc" />
          Visible to patient
        </label>
        <Button onClick={addNote} disabled={saving}>Save note</Button>
      </Card>

      <div className="mt-6">
        <h3 className="text-[13px] font-bold text-t2 mb-3">Previous notes</h3>
        {loading ? (
          <Loader />
        ) : notes.length === 0 ? (
          <Empty>No notes yet</Empty>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="bg-s2 border border-b1 rounded-lg px-3.5 py-3">
                <div className="text-[11px] text-t3 mb-1 capitalize">{n.note_type || "general"} · {fmtDateTime(n.created_at)}</div>
                <div className="text-[13px] text-t2 leading-relaxed">{n.content || ""}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
