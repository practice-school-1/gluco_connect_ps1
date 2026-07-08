import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import { useAlerts } from "../../lib/alerts";
import { PageHeader } from "../../components/Shell";
import { Button, Card, Empty, Loader, StatCard, fmtDateTime } from "../../components/ui";

export default function Overview() {
  const navigate = useNavigate();
  const { refresh: refreshAlertCount } = useAlerts();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ patients: null, alerts: null, meds: null, notes: null });
  const [alerts, setAlerts] = useState([]);
  const [notes, setNotes] = useState([]);

  async function load() {
    setLoading(true);
    const [pts, alrts, meds, ntes] = await Promise.allSettled([
      api("GET", "/doctors/patients"),
      api("GET", "/alerts/unresolved"),
      api("GET", "/medications"),
      api("GET", "/notes"),
    ]);
    setStats({
      patients: pts.status === "fulfilled" ? (pts.value || []).length : "—",
      alerts: alrts.status === "fulfilled" ? (alrts.value || []).length : "—",
      meds: meds.status === "fulfilled" ? (meds.value || []).length : "—",
      notes: ntes.status === "fulfilled" ? (ntes.value || []).length : "—",
    });
    setAlerts(alrts.status === "fulfilled" ? alrts.value || [] : []);
    setNotes(ntes.status === "fulfilled" ? ntes.value || [] : []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function resolveAlert(id) {
    try {
      await api("PATCH", `/alerts/${id}/resolve`);
      load();
      refreshAlertCount();
    } catch (e) {
      alert(e.message);
    }
  }

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  return (
    <div>
      <PageHeader title="Overview" subtitle={today} />

      {loading ? (
        <Loader />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Patients" value={stats.patients} unit="linked" tone="b" icon="👥" />
            <StatCard label="Alerts" value={stats.alerts} unit="unresolved" tone="r" icon="⚠" />
            <StatCard label="Medications" value={stats.meds} unit="active" tone="y" icon="💊" />
            <StatCard label="Notes" value={stats.notes} unit="written" tone="p" icon="📝" />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-5">
            <Card title="Unresolved alerts" action={<Button variant="ghost" size="sm" onClick={() => navigate("/doctor/alerts")}>View all →</Button>}>
              {alerts.length === 0 ? (
                <Empty icon="✅">No unresolved alerts</Empty>
              ) : (
                <div className="divide-y divide-b1">
                  {alerts.slice(0, 5).map((a) => (
                    <div key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm shrink-0 ${
                        a.type?.includes("high") || a.type?.includes("miss") ? "bg-red/10" : "bg-yel/10"
                      }`}>
                        {a.type?.includes("low") ? "↓" : "↑"}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold capitalize">{(a.type || "Alert").replace(/_/g, " ")}</div>
                        <div className="text-xs text-t3 mt-0.5 truncate">{a.message || ""} · {fmtDateTime(a.created_at)}</div>
                      </div>
                      <Button variant="success" size="sm" onClick={() => resolveAlert(a.id)}>Resolve</Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card title="Recent notes" action={<Button variant="ghost" size="sm" onClick={() => navigate("/doctor/notes")}>View all →</Button>}>
              {notes.length === 0 ? (
                <Empty icon="📝">No notes yet</Empty>
              ) : (
                <div className="space-y-2">
                  {notes.slice(0, 3).map((n) => (
                    <div key={n.id} className="bg-s2 border border-b1 rounded-lg px-3.5 py-3">
                      <div className="text-[11px] text-t3 mb-1 capitalize">{n.note_type || "general"} · {fmtDateTime(n.created_at)}</div>
                      <div className="text-[13px] text-t2 leading-relaxed">{n.content || ""}</div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
