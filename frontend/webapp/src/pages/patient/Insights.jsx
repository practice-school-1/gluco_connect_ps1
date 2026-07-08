import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Badge, Card, Empty, Loader, fmtDateTime } from "../../components/ui";

const FLAG_LABEL = { normal: "✓ Good", warning: "↑ Notice", danger: "⚠ Attention", info: "ℹ Info" };
const FLAG_CLASS = {
  normal: "bg-grn/8 border-grn/20",
  warning: "bg-yel/8 border-yel/20",
  danger: "bg-red/8 border-red/20",
  info: "bg-blu/8 border-blu/20",
};

export default function Insights() {
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([api("GET", "/insights"), api("GET", "/alerts/unresolved")]).then(([ins, al]) => {
      setInsights(ins.status === "fulfilled" ? ins.value || [] : []);
      setAlerts(al.status === "fulfilled" ? al.value || [] : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <Loader />;

  return (
    <div>
      <PageHeader title="Insights" subtitle="AI-powered health nudges based on your data." />

      {insights.length === 0 ? (
        <Card className="mb-5">
          <Empty icon="✦">No insights yet. Keep logging daily.</Empty>
        </Card>
      ) : (
        <div className="space-y-3 mb-5">
          {insights.map((i) => (
            <div key={i.id} className={`rounded-lg p-4 border ${FLAG_CLASS[i.flag] || FLAG_CLASS.info}`}>
              <div className="text-[10px] font-bold uppercase tracking-wider mb-2 text-t2">{FLAG_LABEL[i.flag] || "ℹ Info"}</div>
              <div className="text-sm text-t1 leading-relaxed">{i.message}</div>
              <div className="text-[11px] text-t3 mt-2">{fmtDateTime(i.created_at)}</div>
            </div>
          ))}
        </div>
      )}

      <Card title="Unresolved alerts">
        {alerts.length === 0 ? (
          <Empty icon="✅">No unresolved alerts — great work!</Empty>
        ) : (
          <div className="divide-y divide-b1">
            {alerts.map((a) => (
              <div key={a.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-t1 capitalize">{(a.type || "Alert").replace(/_/g, " ")}</div>
                  <div className="text-xs text-t3 mt-0.5">{a.message || ""} · {fmtDateTime(a.created_at)}</div>
                </div>
                <Badge tone="red">Active</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
