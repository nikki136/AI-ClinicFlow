# AI ClinicFlow

AI ClinicFlow is a demonstration clinic-administration application. It uses React, Flask, SQLite and the Gemini API to classify sample patient enquiries and draft administrative replies.

## Features
- Dashboard metrics for enquiries and appointments
- Gemini-powered enquiry categorisation and administrative reply drafts
- Priority flags for human review
- Enquiry search and status updates
- Appointment creation and status management
- SQLite persistence

## Important safety note
This is an educational prototype, not a clinical decision-support system or production healthcare product. Use fictional data only. It does not diagnose or recommend treatment. AI-generated classifications and replies must be reviewed by clinic staff. Do not enter real patient information.

## Requirements
Python 3.10+
Node.js 20.19+ or 22.12+
Gemini API key


## 1. Start the backend

Open a terminal in the project root:

```powershell
cd backend
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
python app.py
```

Edit `backend/.env` and add your Gemini API key:

```env
GEMINI_API_KEY=your_actual_key
GEMINI_MODEL=gemini-2.5-flash
FRONTEND_ORIGIN=http://localhost:5173
```

Run:

```powershell
python app.py
```

Backend runs at `http://127.0.0.1:5000`.

## 2. Start the frontend

Open a second terminal in the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally `http://localhost:5173`.

## API endpoints
- `GET /` - API status
- `GET /api/health` - health and AI configuration status
- `GET /api/dashboard` - dashboard counts
- `GET /api/enquiries` - list enquiries
- `POST /api/enquiries` - AI analyse and save an enquiry
- `PATCH /api/enquiries/<id>` - update enquiry status
- `GET /api/appointments` - list appointments
- `POST /api/appointments` - create appointment
- `PATCH /api/appointments/<id>` - update appointment status

## GitHub safety
Do not commit `.env`, API keys, the virtual environment, or the SQLite database. The included `.gitignore` excludes them.
