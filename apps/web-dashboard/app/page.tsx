import Link from "next/link";

export default function Home() {
  return (
    <main className="page">
      <h1>Mamute MAA Dashboard</h1>
      <p className="muted">
        Front-desk and admin controls: barcode check-in, class management, membership
        status, and outgoing announcements.
      </p>

      <div className="grid" style={{ marginTop: 18 }}>
        <div className="card">
          <h3>Front Desk Check-in</h3>
          <p className="muted">
            Use the USB/Bluetooth barcode scanner to log attendance and surface payment
            status in real time.
          </p>
          <Link href="/check-in" className="btn" style={{ marginTop: 12 }}>
            Go to Check-in
          </Link>
        </div>

        <div className="card">
          <h3>Classes</h3>
          <p className="muted">
            View upcoming classes, capacity, and status. Instructors can cancel or
            reschedule directly.
          </p>
          <Link href="/classes" className="btn" style={{ marginTop: 12 }}>
            View Classes
          </Link>
        </div>

        <div className="card">
          <h3>Announcements</h3>
          <p className="muted">
            Broadcast reminders, cancellations, and dues alerts to students/parents.
          </p>
          <Link href="/announcements" className="btn" style={{ marginTop: 12 }}>
            Send Message
          </Link>
        </div>
      </div>
    </main>
  );
}
