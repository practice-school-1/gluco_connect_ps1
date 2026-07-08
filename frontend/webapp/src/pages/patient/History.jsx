import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Badge, Card, Empty, Loader, glucoseBadge, fmtDate, fmtDateTime } from "../../components/ui";

export default function History() {
  const [loading, setLoading] = useState(true);
  const [glucose, setGlucose] = useState([]);
  const [meals, setMeals] = useState([]);
  const [activities, setActivities] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([api("GET", "/glucose"), api("GET", "/meals"), api("GET", "/activities")]).then(([g, m, a]) => {
      setGlucose(g.status === "fulfilled" ? g.value || [] : []);
      setMeals(m.status === "fulfilled" ? m.value || [] : []);
      setActivities(a.status === "fulfilled" ? a.value || [] : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader title="History" subtitle="All your logged data." />

      <Card title="Glucose readings" className="mb-5">
        {glucose.length === 0 ? (
          <Empty>No readings yet</Empty>
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
                {glucose.map((r) => (
                  <tr key={r.id} className="hover:bg-s2">
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

      <Card title="Meals" className="mb-5">
        {meals.length === 0 ? (
          <Empty>No meals yet</Empty>
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
                {meals.map((m) => (
                  <tr key={m.id} className="hover:bg-s2">
                    <td className="px-3.5 py-2.5 border-b border-b1"><Badge tone="blu">{m.meal_type || "—"}</Badge></td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t1">{(m.meal_items?.length ? m.meal_items.map((i) => i.name).join(", ") : m.notes) || "—"}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{m.total_carbs_grams ?? "—"}</td>
                    <td className="px-3.5 py-2.5 border-b border-b1 text-t2">{fmtDateTime(m.logged_at || m.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="Activities">
        {activities.length === 0 ? (
          <Empty>No activities yet</Empty>
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
                {activities.map((a) => (
                  <tr key={a.id} className="hover:bg-s2">
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
    </div>
  );
}
