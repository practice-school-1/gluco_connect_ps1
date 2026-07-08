import { useEffect, useMemo, useState } from "react";
import { api } from "../../lib/api";
import { useAlerts } from "../../lib/alerts";
import { PageHeader } from "../../components/Shell";
import { Badge, Button, Card, Empty, Loader, Select, fmtDateTime } from "../../components/ui";

export default function Alerts() {
  const { refresh: refreshAlertCount } = useAlerts();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [filter, setFilter] = useState("unresolved");

  function load() {
    setLoading(true);
    api("GET", "/alerts")
      .then((d) => setAlerts(d || []))
      .finally(() => setLoading(false));
  }

  useEffect(load, []);

  const visible = useMemo(
    () => (filter === "unresolved" ? alerts.filter((a) => !a.is_resolved) : alerts),
    [alerts, filter]
  );

  async function resolve(id) {
    try {
      await api("PATCH", `/alerts/${id}/resolve`);
      load();
      refreshAlertCount();
    } catch (e) {
      alert(e.message);
    }
  }

  return (
    <div>
      <PageHeader title="Alerts" subtitle="Health alerts across all patients." />

      <Card className="mb-4">
        <Select value={filter} onChange={(e) => setFilter(e.target.value)} className="max-w-[200px]">
          <option value="unresolved">Unresolved only</option>
          <option value="all">All alerts</option>
        </Select>
      </Card>

      <Card>
        {loading ? (
          <Loader />
        ) : visible.length === 0 ? (
          <Empty icon="✅">No alerts</Empty>
        ) : (
          <div className="divide-y divide-b1">
            {visible.map((a) => (
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
                {!a.is_resolved ? (
                  <Button variant="success" size="sm" onClick={() => resolve(a.id)}>Resolve</Button>
                ) : (
                  <Badge tone="grn">Resolved</Badge>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
