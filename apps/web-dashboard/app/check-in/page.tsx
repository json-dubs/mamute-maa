"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { recordAttendance, AttendanceResponse } from "@mamute/api";
import { classifyStatus, parseBarcode } from "@mamute/utils";

export default function CheckInPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [barcode, setBarcode] = useState("");
  const [result, setResult] = useState<AttendanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsed = parseBarcode(barcode);
    if (!parsed) {
      setError("Scan a valid barcode");
      return;
    }
    setLoading(true);
    try {
      const data = await recordAttendance({
        barcode: parsed,
        source: "web",
        deviceId: "front-desk"
      });
      setResult(data);
      setBarcode("");
    } catch (err: any) {
      setError(err?.message ?? "Check-in failed");
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const membershipStatus = result?.membership?.status
    ? classifyStatus(result.membership.status)
    : null;

  return (
    <main className="page">
      <h1>Front Desk Check-in</h1>
      <p className="muted">Scan student barcode with the USB/Bluetooth scanner.</p>

      <form onSubmit={submit} style={{ marginTop: 18 }}>
        <input
          ref={inputRef}
          className="input"
          placeholder="Scan barcode"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          disabled={loading}
        />
      </form>

      <div style={{ marginTop: 16 }} className="card">
        {loading && <p className="muted">Checking in...</p>}
        {error && <p style={{ color: "#fca5a5" }}>{error}</p>}
        {result ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Member</span>
              <strong>{result.attendance.profileId}</strong>
            </div>
            {membershipStatus ? (
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Membership</span>
                <span>{membershipStatus.label}</span>
              </div>
            ) : null}
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Timestamp</span>
              <span>{new Date(result.attendance.scannedAt).toLocaleString()}</span>
            </div>
          </div>
        ) : (
          <p className="muted">Awaiting scan...</p>
        )}
      </div>
    </main>
  );
}
