import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Alert, Button, Card, Empty, Input, Loader, Select, Textarea, glucoseBadge, fmtDateTime } from "../../components/ui";

function isToday(d) {
  return d && new Date(d).toDateString() === new Date().toDateString();
}
function nowLocal() {
  const n = new Date();
  n.setMinutes(n.getMinutes() - n.getTimezoneOffset());
  return n.toISOString().slice(0, 16);
}

export default function LogGlucose() {
  const [form, setForm] = useState({ value: "", type: "fasting", time: nowLocal(), notes: "" });
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ tone: "error", text: "" });
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState([]);

  function loadSide() {
    setLoading(true);
    api("GET", "/glucose")
      .then((d) => {
        const t = (d || []).filter((r) => isToday(r.recorded_at || r.created_at)).sort((a, b) => new Date(b.recorded_at) - new Date(a.recorded_at));
        setToday(t);
      })
      .finally(() => setLoading(false));
  }

  useEffect(loadSide, []);

  async function save(e) {
    e.preventDefault();
    const v = parseFloat(form.value);
    if (!v || v < 20 || v > 600) {
      setAlertMsg({ tone: "error", text: "Enter a valid value (20–600 mg/dL)." });
      return;
    }
    setSaving(true);
    setAlertMsg({ tone: "error", text: "" });
    try {
      await api("POST", "/glucose", {
        value_mg_dl: v,
        reading_type: form.type,
        recorded_at: form.time || new Date().toISOString(),
        notes: form.notes || undefined,
      });
      setAlertMsg({ tone: "success", text: "✓ Reading saved!" });
      setForm({ value: "", type: form.type, time: nowLocal(), notes: "" });
      loadSide();
    } catch (err) {
      setAlertMsg({ tone: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const avg = today.length ? Math.round(today.reduce((s, r) => s + r.value_mg_dl, 0) / today.length) : null;

  return (
    <div>
      <PageHeader title="Log glucose" subtitle="Record your blood glucose measurement." />
      <div className="flex gap-6 items-start flex-wrap">
        <Card className="max-w-[480px] w-full">
          <form onSubmit={save}>
            <Alert tone={alertMsg.tone}>{alertMsg.text}</Alert>
            <Input
              label="Glucose value (mg/dL) *"
              type="number"
              min={20}
              max={600}
              placeholder="e.g. 105"
              className="mb-4"
              style={{ fontSize: 22, fontWeight: 700 }}
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
            />
            <Select label="Reading type *" className="mb-4" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="fasting">Fasting (morning)</option>
              <option value="pre_meal">Pre-meal</option>
              <option value="post_meal">Post-meal (2h after)</option>
              <option value="random">Random</option>
              <option value="bedtime">Bedtime</option>
            </Select>
            <Input label="Date & time" type="datetime-local" className="mb-4" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} />
            <Textarea label="Notes" placeholder="Any context…" className="mb-4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button type="submit" disabled={saving}>Save reading</Button>
          </form>
        </Card>

        <Card title="Today so far" className="flex-1 min-w-[300px]">
          {loading ? (
            <Loader />
          ) : (
            <>
              <div className="flex gap-6 pb-3.5 mb-1.5 border-b border-b1">
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-t1">{today.length}</div>
                  <div className="text-[11px] uppercase tracking-wider text-t3 font-semibold mt-1">Readings</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-t1">{avg ?? "—"}</div>
                  <div className="text-[11px] uppercase tracking-wider text-t3 font-semibold mt-1">Avg mg/dL</div>
                </div>
              </div>
              {today.length === 0 ? (
                <Empty icon="🩸">No readings yet today</Empty>
              ) : (
                <div className="divide-y divide-b1">
                  {today.map((r) => (
                    <div key={r.id} className="py-2.5 flex items-center justify-between">
                      <div>{glucoseBadge(r.value_mg_dl)}</div>
                      <div className="text-xs text-t3 capitalize">{(r.reading_type || "").replace(/_/g, " ")} · {fmtDateTime(r.recorded_at)}</div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
