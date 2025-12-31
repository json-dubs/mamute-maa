"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { cancelClass, fetchSchedules } from "@mamute/api";
import { ClassSchedule } from "@mamute/types";
import { formatTimeRange } from "@mamute/utils";

export default function ClassesPage() {
  const [items, setItems] = useState<ClassSchedule[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchSchedules();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const cancel = async (id: string) => {
    await cancelClass(id, "cancelled");
    await load();
  };

  return (
    <main className="page">
      <h1>Classes</h1>
      <p className="muted">Upcoming classes across disciplines.</p>
      {loading ? <p className="muted">Loading...</p> : null}
      <div className="grid" style={{ marginTop: 16 }}>
        {items.map((item) => (
          <div key={item.id} className="card">
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <strong>{item.title}</strong>
              <span className="muted">{item.discipline}</span>
            </div>
            <p className="muted">{formatTimeRange(item.startAt, item.endAt)}</p>
            <p className="muted">Instructor: {item.instructorId}</p>
            {item.status !== "cancelled" ? (
              <button className="btn" onClick={() => cancel(item.id)} style={{ marginTop: 10 }}>
                Cancel class
              </button>
            ) : (
              <span className="muted" style={{ display: "inline-block", marginTop: 10 }}>
                Cancelled
              </span>
            )}
          </div>
        ))}
      </div>
      <Link href="/" className="btn" style={{ marginTop: 16 }}>
        Back to dashboard
      </Link>
    </main>
  );
}
