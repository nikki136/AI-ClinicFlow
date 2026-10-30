import json
import os
import re
import sqlite3
from datetime import datetime
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
from google import genai

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
DATABASE = BASE_DIR / "clinicflow.db"

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")}})

api_key = os.getenv("GEMINI_API_KEY")
client = genai.Client(api_key=api_key) if api_key else None
MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def get_db():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    with get_db() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS enquiries (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_name TEXT NOT NULL,
                message TEXT NOT NULL,
                category TEXT NOT NULL,
                priority TEXT NOT NULL,
                ai_reply TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'Pending',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)
        conn.execute("""
            CREATE TABLE IF NOT EXISTS appointments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                patient_name TEXT NOT NULL,
                appointment_date TEXT NOT NULL,
                appointment_time TEXT NOT NULL,
                reason TEXT DEFAULT '',
                status TEXT NOT NULL DEFAULT 'Scheduled',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        """)


def analyze_enquiry(message):
    if not client:
        raise RuntimeError("Gemini API key is missing. Add GEMINI_API_KEY to backend/.env.")

    prompt = f"""
You are an administrative assistant for a healthcare clinic.
Classify the enquiry below for clinic staff. This is an administrative task only.

Patient enquiry:
{message}

Return only a valid JSON object with exactly these keys:
{{
  "category": "Appointment | Billing | General | Other",
  "priority": "Normal | High | Urgent",
  "reply": "A concise, polite administrative response"
}}

Rules:
- Never diagnose, recommend medicines, or provide treatment advice.
- If the message suggests a possible emergency or immediate danger, set priority to
  "Urgent" and tell the person to contact local emergency services immediately.
- "High" is for time-sensitive administrative matters; otherwise use "Normal".
- Do not claim an appointment has been booked.
- The reply must direct clinical questions to a qualified healthcare professional.
"""
    response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
    raw = (response.text or "").strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw)
    result = json.loads(raw)

    categories = {"Appointment", "Billing", "General", "Other"}
    priorities = {"Normal", "High", "Urgent"}
    if result.get("category") not in categories or result.get("priority") not in priorities:
        raise ValueError("AI returned an unexpected category or priority.")
    reply = str(result.get("reply", "")).strip()
    if not reply:
        raise ValueError("AI did not return a response.")
    return {"category": result["category"], "priority": result["priority"], "reply": reply}


@app.get("/")
def home():
    return jsonify({"name": "AI ClinicFlow API", "status": "running"})


@app.get("/api/health")
def health():
    return jsonify({"status": "ok", "ai_configured": bool(client)})


@app.get("/api/dashboard")
def dashboard():
    with get_db() as conn:
        enquiries = conn.execute("SELECT COUNT(*) FROM enquiries").fetchone()[0]
        pending = conn.execute("SELECT COUNT(*) FROM enquiries WHERE status = 'Pending'").fetchone()[0]
        urgent = conn.execute("SELECT COUNT(*) FROM enquiries WHERE priority = 'Urgent' AND status != 'Resolved'").fetchone()[0]
        appointments = conn.execute("SELECT COUNT(*) FROM appointments").fetchone()[0]
    return jsonify({
        "total_enquiries": enquiries,
        "pending_enquiries": pending,
        "urgent_enquiries": urgent,
        "total_appointments": appointments
    })


@app.route("/api/enquiries", methods=["GET", "POST"])
def enquiries():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = str(data.get("patient_name", "")).strip()
        message = str(data.get("message", "")).strip()
        if not name or not message:
            return jsonify({"error": "Patient name and enquiry are required."}), 400
        if len(name) > 100 or len(message) > 2000:
            return jsonify({"error": "Name or enquiry is too long."}), 400
        try:
            analysis = analyze_enquiry(message)
            with get_db() as conn:
                cur = conn.execute("""
                    INSERT INTO enquiries (patient_name, message, category, priority, ai_reply)
                    VALUES (?, ?, ?, ?, ?)
                """, (name, message, analysis["category"], analysis["priority"], analysis["reply"]))
                enquiry_id = cur.lastrowid
            return jsonify({"id": enquiry_id, "patient_name": name, **analysis, "status": "Pending"}), 201
        except Exception:
                app.logger.exception("Enquiry analysis failed")
                return jsonify({"error": "Could not analyse the enquiry. Check the API key, quota, and server logs."}), 502

    with get_db() as conn:
        rows = conn.execute("SELECT * FROM enquiries ORDER BY id DESC").fetchall()
    return jsonify([dict(row) for row in rows])


@app.patch("/api/enquiries/<int:enquiry_id>")
def update_enquiry(enquiry_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in {"Pending", "Reviewed", "Resolved"}:
        return jsonify({"error": "Status must be Pending, Reviewed, or Resolved."}), 400
    with get_db() as conn:
        cur = conn.execute("UPDATE enquiries SET status = ? WHERE id = ?", (status, enquiry_id))
    if cur.rowcount == 0:
        return jsonify({"error": "Enquiry not found."}), 404
    return jsonify({"success": True, "status": status})


@app.route("/api/appointments", methods=["GET", "POST"])
def appointments():
    if request.method == "POST":
        data = request.get_json(silent=True) or {}
        name = str(data.get("patient_name", "")).strip()
        date = str(data.get("appointment_date", "")).strip()
        time = str(data.get("appointment_time", "")).strip()
        reason = str(data.get("reason", "")).strip()
        if not name or not date or not time:
            return jsonify({"error": "Patient name, date, and time are required."}), 400
        try:
            datetime.strptime(date, "%Y-%m-%d")
            datetime.strptime(time, "%H:%M")
        except ValueError:
            return jsonify({"error": "Enter a valid date and time."}), 400
        if len(name) > 100 or len(reason) > 300:
            return jsonify({"error": "Input is too long."}), 400
        with get_db() as conn:
            cur = conn.execute("""
                INSERT INTO appointments (patient_name, appointment_date, appointment_time, reason)
                VALUES (?, ?, ?, ?)
            """, (name, date, time, reason))
        return jsonify({"id": cur.lastrowid, "message": "Appointment added."}), 201

    with get_db() as conn:
        rows = conn.execute("SELECT * FROM appointments ORDER BY appointment_date, appointment_time").fetchall()
    return jsonify([dict(row) for row in rows])


@app.patch("/api/appointments/<int:appointment_id>")
def update_appointment(appointment_id):
    data = request.get_json(silent=True) or {}
    status = data.get("status")
    if status not in {"Scheduled", "Completed", "Cancelled"}:
        return jsonify({"error": "Invalid appointment status."}), 400
    with get_db() as conn:
        cur = conn.execute("UPDATE appointments SET status = ? WHERE id = ?", (status, appointment_id))
    if cur.rowcount == 0:
        return jsonify({"error": "Appointment not found."}), 404
    return jsonify({"success": True, "status": status})


if __name__ == "__main__":
    init_db()
    app.run(host="127.0.0.1", port=5000, debug=True)
