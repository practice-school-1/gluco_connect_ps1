import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Badge, Button, Card, Empty, Loader, StatCard, glucoseBadge, fmtDateTime } from "../../components/ui";

function isToday(d) {
  return d && new Date(d).toDateString() === new Date().toDateString();
}

const INSIGHT_LABEL = { normal: "✓ Good", warning: "↑ Notice", danger: "⚠ Attention", info: "ℹ Info" };

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);
  const [todayReadings, setTodayReadings] = useState([]);
  const [adherence, setAdherence] = useState([]);
  const [insight, setInsight] = useState(null);

  async function load() {
    setLoading(true);
    const [sum, glu, adh, ins] = await Promise.allSettled([
      api("GET", "/summary/daily"),
      api("GET", "/glucose"),
      api("GET", "/medications/adherence/today"),
      api("GET", "/insights/daily"),
    ]);
    setSummary(sum.status === "fulfilled" ? sum.value : null);
    setTodayReadings(
      glu.status === "fulfilled"
        ? (glu.value || [])
            .filter((r) => isToday(r.recorded_at || r.created_at))
            .sort((a, b) => new Date(a.recorded_at) - new Date(b.recorded_at))
        : []
    );
    setAdherence(adh.status === "fulfilled" ? adh.value || [] : []);
    setInsight(ins.status === "fulfilled" ? ins.value : null);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function quickMed(id, skip) {
    try {
      await api("POST", `/medications/${id}/log`, { skipped: skip });
      load();
    } catch (e) {
      alert(e.message);
    }
  }

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const latest = todayReadings[todayReadings.length - 1];
  const readingsCount = summary?.glucose?.count ?? todayReadings.length;
  const steps = summary?.activity?.total_steps ?? "—";

  const chartData = todayReadings.map((r) => ({
    time: new Date(r.recorded_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    value: r.value_mg_dl,
  }));

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader title={`Good ${greeting} 👋`} subtitle={today} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Latest glucose" value={latest?.value_mg_dl ?? "—"} unit="mg/dL" tone="g" icon="🩸" />
        <StatCard label="Readings today" value={readingsCount} unit="logged" tone="b" icon="📊" />
        <StatCard label="Steps today" value={steps} unit="steps" tone="y" icon="👟" />
      </div>

      <Card title="Today's glucose trend" className="mt-5">
        {chartData.length === 0 ? (
          <Empty icon="📈">
            <Button size="sm" onClick={() => navigate("/patient/log-glucose")}>Log a reading to see your trend</Button>
          </Empty>
        ) : (
          <div style={{ height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e1e0d9" vertical={false} />
                <XAxis dataKey="time" tick={{ fill: "#8b8f98", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[40, "auto"]} tick={{ fill: "#8b8f98", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "#fff", border: "1px solid #e4e7ec", borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v} mg/dL`, "Glucose"]} />
                <ReferenceLine y={70} stroke="#b45309" strokeDasharray="4 3" />
                <ReferenceLine y={140} stroke="#b45309" strokeDasharray="4 3" />
                <Line type="monotone" dataKey="value" stroke="#2a78d6" strokeWidth={2.5} dot={{ r: 4, fill: "#2a78d6" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mt-5">
        <Card title="Recent readings" action={<Button variant="ghost" size="sm" onClick={() => navigate("/patient/history")}>View all →</Button>}>
          {todayReadings.length === 0 ? (
            <Empty icon="🩸">No readings yet</Empty>
          ) : (
            <div className="divide-y divide-b1">
              {[...todayReadings].reverse().slice(0, 5).map((r) => (
                <div key={r.id} className="py-2.5 flex items-center justify-between">
                  <div>{glucoseBadge(r.value_mg_dl)}</div>
                  <div className="text-xs text-t3 capitalize">{(r.reading_type || "").replace(/_/g, " ")} · {fmtDateTime(r.recorded_at)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title="Today's medications" action={<Button variant="ghost" size="sm" onClick={() => navigate("/patient/medications")}>View all →</Button>}>
          {adherence.length === 0 ? (
            <Empty icon="💊">No medications</Empty>
          ) : (
            <div className="divide-y divide-b1">
              {adherence.map((m) => {
                const status = m.today_log ? (m.today_log.skipped ? "skipped" : "taken") : "";
                return (
                  <div key={m.medication_id} className="py-2.5 flex items-center gap-3">
                    <div className="flex-1">
                      <div className="text-sm font-semibold text-t1">{m.name}</div>
                      <div className="text-xs text-t3">{[m.dosage, m.frequency].filter(Boolean).join(" · ")}</div>
                    </div>
                    {status ? (
                      <Badge tone={status === "taken" ? "grn" : "yel"}>{status}</Badge>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => quickMed(m.medication_id, true)}>Skip</Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <Card title="Today's insight" className="mt-5">
        {insight ? (
          <div className={`rounded-lg p-4 border ${insight.flag === "danger" ? "bg-red/8 border-red/20" : insight.flag === "warning" ? "bg-yel/8 border-yel/20" : insight.flag === "normal" ? "bg-grn/8 border-grn/20" : "bg-blu/8 border-blu/20"}`}>
            <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-t2">{INSIGHT_LABEL[insight.flag] || "ℹ Info"}</div>
            <div className="text-sm text-t1 leading-relaxed">{insight.message}</div>
          </div>
        ) : (
          <p className="text-sm text-t3">Log glucose, meals and activity daily to unlock personalized insights.</p>
        )}
      </Card>
    </div>
  );
}
