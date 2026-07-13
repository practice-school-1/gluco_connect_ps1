import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Alert, Button, Card, Empty, Input, Loader, Select, Textarea, fmtDate } from "../../components/ui";

function isToday(d) {
  return d && new Date(d).toDateString() === new Date().toDateString();
}
function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function LogActivity() {
  const [form, setForm] = useState({ type: "walking", steps: "", duration: "", cal: "", intensity: "moderate", date: todayStr(), notes: "" });
  const [saving, setSaving] = useState(false);
  const [alertMsg, setAlertMsg] = useState({ tone: "error", text: "" });
  const [loading, setLoading] = useState(true);
  const [today, setToday] = useState([]);

  const [googleHealth, setGoogleHealth] = useState({ connected: false, loading: true });
  const [googleHealthBusy, setGoogleHealthBusy] = useState(false);
  const [googleHealthMsg, setGoogleHealthMsg] = useState({ tone: "error", text: "" });

  function loadSide() {
    setLoading(true);
    api("GET", "/activities")
      .then((d) => {
        const t = (d || []).filter((a) => isToday(a.date || a.created_at)).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        setToday(t);
      })
      .finally(() => setLoading(false));
  }

  function loadGoogleHealthStatus() {
    setGoogleHealth((f) => ({ ...f, loading: true }));
    api("GET", "/google-health/status")
      .then((d) => setGoogleHealth({ connected: !!d.connected, connected_at: d.connected_at, loading: false }))
      .catch(() => setGoogleHealth({ connected: false, loading: false }));
  }

  useEffect(loadSide, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      window.history.replaceState({}, "", window.location.pathname);
      setGoogleHealthBusy(true);
      api("POST", "/google-health/callback", { code })
        .then(() => {
          setGoogleHealthMsg({ tone: "success", text: "✓ Google Health connected!" });
          loadGoogleHealthStatus();
        })
        .catch((err) => setGoogleHealthMsg({ tone: "error", text: err.message }))
        .finally(() => setGoogleHealthBusy(false));
    } else {
      loadGoogleHealthStatus();
    }
  }, []);

  async function connectGoogleHealth() {
    setGoogleHealthBusy(true);
    setGoogleHealthMsg({ tone: "error", text: "" });
    try {
      const { auth_url } = await api("GET", "/google-health/auth-url");
      window.location.href = auth_url;
    } catch (err) {
      setGoogleHealthMsg({ tone: "error", text: err.message });
      setGoogleHealthBusy(false);
    }
  }

  async function syncGoogleHealth() {
    setGoogleHealthBusy(true);
    setGoogleHealthMsg({ tone: "error", text: "" });
    try {
      await api("POST", "/google-health/sync");
      setGoogleHealthMsg({ tone: "success", text: "✓ Synced with Google Health!" });
      loadSide();
    } catch (err) {
      setGoogleHealthMsg({ tone: "error", text: err.message });
    } finally {
      setGoogleHealthBusy(false);
    }
  }

  async function disconnectGoogleHealth() {
    setGoogleHealthBusy(true);
    setGoogleHealthMsg({ tone: "error", text: "" });
    try {
      await api("DELETE", "/google-health/disconnect");
      setGoogleHealthMsg({ tone: "success", text: "Google Health disconnected." });
      loadGoogleHealthStatus();
    } catch (err) {
      setGoogleHealthMsg({ tone: "error", text: err.message });
    } finally {
      setGoogleHealthBusy(false);
    }
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setAlertMsg({ tone: "error", text: "" });
    try {
      const body = { activity_type: form.type, intensity: form.intensity, date: form.date || todayStr() };
      if (form.steps) body.steps = parseInt(form.steps, 10);
      if (form.duration) body.active_minutes = parseInt(form.duration, 10);
      if (form.cal) body.calories_burned = parseFloat(form.cal);
      if (form.notes) body.notes = form.notes;
      await api("POST", "/activities", body);
      setAlertMsg({ tone: "success", text: "✓ Activity saved!" });
      setForm({ ...form, steps: "", duration: "", cal: "", notes: "" });
      loadSide();
    } catch (err) {
      setAlertMsg({ tone: "error", text: err.message });
    } finally {
      setSaving(false);
    }
  }

  const totalSteps = today.reduce((s, a) => s + (a.steps || 0), 0);

  return (
    <div>
      <PageHeader title="Log activity" subtitle="Track your physical activity." />

      <Card title="Google Health" className="mb-6">
        <Alert tone={googleHealthMsg.tone}>{googleHealthMsg.text}</Alert>
        {googleHealth.loading ? (
          <Loader />
        ) : (
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="text-sm text-t2">
              {googleHealth.connected ? (
                <>🟢 Connected — steps and heart rate sync automatically.</>
              ) : (
                <>
                  Connect Google Health to auto-log steps, active minutes and heart rate from Fitbit, Pixel Watch and other connected apps.
                  <div className="text-xs text-t3 mt-1">Requires a Fitbit account or Health Connect device already linked to this Google account.</div>
                </>
              )}
            </div>
            <div className="flex gap-2">
              {googleHealth.connected ? (
                <>
                  <Button variant="secondary" size="sm" disabled={googleHealthBusy} onClick={syncGoogleHealth}>Sync now</Button>
                  <Button variant="danger" size="sm" disabled={googleHealthBusy} onClick={disconnectGoogleHealth}>Disconnect</Button>
                </>
              ) : (
                <Button size="sm" disabled={googleHealthBusy} onClick={connectGoogleHealth}>Connect Google Health</Button>
              )}
            </div>
          </div>
        )}
      </Card>

      <div className="flex gap-6 items-start flex-wrap">
        <Card className="max-w-[480px] w-full">
          <form onSubmit={save}>
            <Alert tone={alertMsg.tone}>{alertMsg.text}</Alert>
            <Select label="Activity type" className="mb-4" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="walking">🚶 Walking</option>
              <option value="running">🏃 Running</option>
              <option value="yoga">🧘 Yoga</option>
              <option value="gym">🏋️ Gym</option>
              <option value="cycling">🚴 Cycling</option>
              <option value="swimming">🏊 Swimming</option>
              <option value="other">Other</option>
            </Select>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Steps" type="number" min={0} placeholder="e.g. 5000" value={form.steps} onChange={(e) => setForm({ ...form, steps: e.target.value })} />
              <Input label="Duration (min)" type="number" min={0} placeholder="e.g. 45" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Calories burned" type="number" min={0} placeholder="Optional" value={form.cal} onChange={(e) => setForm({ ...form, cal: e.target.value })} />
              <Select label="Intensity" value={form.intensity} onChange={(e) => setForm({ ...form, intensity: e.target.value })}>
                <option value="light">Light</option>
                <option value="moderate">Moderate</option>
                <option value="vigorous">Vigorous</option>
              </Select>
            </div>
            <Input label="Date *" type="date" className="mb-4" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            <Textarea label="Notes" placeholder="How did it feel?" className="mb-4" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Button type="submit" disabled={saving}>Save activity</Button>
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
                  <div className="text-[11px] uppercase tracking-wider text-t3 font-semibold mt-1">Logged</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold tracking-tight text-t1">{totalSteps}</div>
                  <div className="text-[11px] uppercase tracking-wider text-t3 font-semibold mt-1">Steps</div>
                </div>
              </div>
              {today.length === 0 ? (
                <Empty icon="🏃">No activity logged yet today</Empty>
              ) : (
                <div className="divide-y divide-b1">
                  {today.map((a) => (
                    <div key={a.id} className="py-2.5">
                      <div className="text-sm font-semibold text-t1 capitalize">{a.activity_type || "Activity"}</div>
                      <div className="text-xs text-t3 mt-0.5">
                        {a.steps ? `${a.steps} steps · ` : ""}
                        {a.active_minutes ? `${a.active_minutes} min · ` : ""}
                        {a.intensity || ""} · {fmtDate(a.date || a.created_at)}
                      </div>
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
