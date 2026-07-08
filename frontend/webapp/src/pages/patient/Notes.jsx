import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import { PageHeader } from "../../components/Shell";
import { Card, Empty, Loader, fmtDateTime } from "../../components/ui";

export default function Notes() {
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState([]);

  useEffect(() => {
    api("GET", "/notes")
      .then((d) => setNotes(d || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Doctor notes" subtitle="Notes your doctor has shared with you." />
      <Card>
        {loading ? (
          <Loader />
        ) : notes.length === 0 ? (
          <Empty icon="📝">No notes from your doctor yet</Empty>
        ) : (
          <div className="space-y-2">
            {notes.map((n) => (
              <div key={n.id} className="bg-s2 border border-b1 rounded-lg px-3.5 py-3">
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
