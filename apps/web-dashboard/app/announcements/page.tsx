"use client";

import { useState } from "react";
import Link from "next/link";
import { sendAnnouncement } from "@mamute/api";

export default function AnnouncementsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const send = async () => {
    setMessage(null);
    setSending(true);
    try {
      await sendAnnouncement({ title, body });
      setMessage("Queued to students/parents.");
      setTitle("");
      setBody("");
    } catch (error: any) {
      setMessage(error?.message ?? "Failed to send");
    } finally {
      setSending(false);
    }
  };

  return (
    <main className="page">
      <h1>Announcements</h1>
      <p className="muted">Send reminders, cancellations, and dues alerts.</p>

      <div className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Title
          </div>
          <input
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Schedule change"
          />
        </label>
        <label>
          <div className="muted" style={{ marginBottom: 6 }}>
            Message
          </div>
          <textarea
            className="input"
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Tonight's class begins at 7pm."
            style={{ resize: "vertical" }}
          />
        </label>
        <button className="btn" onClick={send} disabled={sending}>
          {sending ? "Sending..." : "Send Announcement"}
        </button>
        {message ? <p className="muted">{message}</p> : null}
      </div>

      <Link href="/" className="btn" style={{ marginTop: 16 }}>
        Back to dashboard
      </Link>
    </main>
  );
}
