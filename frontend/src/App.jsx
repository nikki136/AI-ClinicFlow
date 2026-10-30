import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarDays, CheckCircle2, CircleAlert, ClipboardList,
  LayoutDashboard, LoaderCircle, MessageSquareText, Plus, RefreshCw,
  Search, Send, ShieldCheck, Sparkles, Users
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000/api';

async function api(path, options = {}) {
  const response = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function StatCard({ icon: Icon, label, value, note, tone = 'blue' }) {
  return <article className="stat-card">
    <div className={`stat-icon ${tone}`}><Icon size={19} /></div>
    <div className="stat-copy"><span>{label}</span><strong>{value}</strong><small>{note}</small></div>
  </article>;
}

function App() {
  const [section, setSection] = useState('overview');
  const [stats, setStats] = useState({ total_enquiries: 0, pending_enquiries: 0, urgent_enquiries: 0, total_appointments: 0 });
  const [enquiries, setEnquiries] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [enquiryForm, setEnquiryForm] = useState({ patient_name: '', message: '' });
  const [appointmentForm, setAppointmentForm] = useState({ patient_name: '', appointment_date: '', appointment_time: '', reason: '' });
  const [lastAnalysis, setLastAnalysis] = useState(null);

  async function refresh() {
    setError('');
    try {
      const [s, e, a] = await Promise.all([
        api('/dashboard'), api('/enquiries'), api('/appointments')
      ]);
      setStats(s); setEnquiries(e); setAppointments(a);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { refresh(); }, []);

  async function submitEnquiry(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice(''); setLastAnalysis(null);
    try {
      const result = await api('/enquiries', { method: 'POST', body: JSON.stringify(enquiryForm) });
      setLastAnalysis(result);
      setEnquiryForm({ patient_name: '', message: '' });
      setNotice('Enquiry analysed and saved. Please review the AI suggestion before responding.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function submitAppointment(event) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try {
      await api('/appointments', { method: 'POST', body: JSON.stringify(appointmentForm) });
      setAppointmentForm({ patient_name: '', appointment_date: '', appointment_time: '', reason: '' });
      setNotice('Appointment added successfully.');
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  }

  async function updateEnquiry(id, status) {
    try { await api(`/enquiries/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); }
    catch (err) { setError(err.message); }
  }

  async function updateAppointment(id, status) {
    try { await api(`/appointments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }); await refresh(); }
    catch (err) { setError(err.message); }
  }

  const filteredEnquiries = useMemo(() => enquiries.filter(item =>
    `${item.patient_name} ${item.message} ${item.category} ${item.status}`.toLowerCase().includes(search.toLowerCase())
  ), [enquiries, search]);

  const navItems = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'enquiries', label: 'Patient enquiries', icon: MessageSquareText },
    { id: 'appointments', label: 'Appointments', icon: CalendarDays }
  ];

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark"><Activity size={21} /></div><div><b>ClinicFlow</b><span>AI OPERATIONS</span></div></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav>{navItems.map(item => <button key={item.id} className={`nav-item ${section === item.id ? 'active' : ''}`} onClick={() => setSection(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === 'enquiries' && stats.pending_enquiries > 0 && <em>{stats.pending_enquiries}</em>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="secure-note"><ShieldCheck size={17} /><div><b>Privacy first</b><span>Use fictional demo data only.</span></div></div><div className="profile"><div className="avatar">AD</div><div><b>Clinic Admin</b><span>Workspace</span></div><span className="online-dot" /></div></div>
    </aside>

    <main className="main-area">
      <header className="topbar"><div className="breadcrumb">Workspace <span>/</span> {navItems.find(n => n.id === section)?.label}</div><div className="top-actions"><span className="system-status"><i /> System online</span><button className="icon-button" onClick={refresh} title="Refresh data"><RefreshCw size={17} /></button><div className="avatar small">AD</div></div></header>
      <div className="page-content">
        <div className="page-heading"><div><div className="eyebrow">CLINIC OPERATIONS</div><h1>{section === 'overview' ? 'Good day, Admin' : section === 'enquiries' ? 'Patient enquiries' : 'Appointments'}</h1><p>{section === 'overview' ? 'Here is what is happening at your clinic today.' : section === 'enquiries' ? 'Review incoming messages and AI-assisted administrative suggestions.' : 'Manage upcoming clinic appointments in one place.'}</p></div><div className="date-chip"><CalendarDays size={16} /> {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</div></div>

        {error && <div className="alert error"><CircleAlert size={17} />{error}</div>}
        {notice && <div className="alert success"><CheckCircle2 size={17} />{notice}</div>}

        {section === 'overview' && <>
          <section className="stats-grid">
            <StatCard icon={Users} label="Total enquiries" value={stats.total_enquiries} note="All recorded messages" tone="blue" />
            <StatCard icon={ClipboardList} label="Pending review" value={stats.pending_enquiries} note="Awaiting staff review" tone="amber" />
            <StatCard icon={CircleAlert} label="Urgent flags" value={stats.urgent_enquiries} note="Requires prompt human review" tone="rose" />
            <StatCard icon={CalendarDays} label="Appointments" value={stats.total_appointments} note="Total appointments recorded" tone="green" />
          </section>
          <div className="content-grid">
            <section className="panel">
              <div className="panel-heading"><div><h2>AI enquiry assistant</h2><p>Classify a message and draft an administrative reply.</p></div><span className="ai-tag"><Sparkles size={14} /> GEMINI AI</span></div>
              <form className="form-stack" onSubmit={submitEnquiry}>
                <label>Patient name<input required maxLength="100" placeholder="e.g. Alex Morgan" value={enquiryForm.patient_name} onChange={e => setEnquiryForm({ ...enquiryForm, patient_name: e.target.value })} /></label>
                <label>Enquiry message<textarea required maxLength="2000" rows="4" placeholder="Type a sample patient enquiry..." value={enquiryForm.message} onChange={e => setEnquiryForm({ ...enquiryForm, message: e.target.value })} /></label>
                <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Sparkles size={17} />} Analyse enquiry</button>
              </form>
              {lastAnalysis && <div className="analysis-result"><div className="result-top"><b><Sparkles size={16} /> AI analysis result</b><span className={`priority ${lastAnalysis.priority.toLowerCase()}`}>{lastAnalysis.priority} priority</span></div><div className="result-meta"><span>Category</span><b>{lastAnalysis.category}</b></div><p>{lastAnalysis.reply}</p><small>AI-generated draft — clinic staff must review before sending.</small></div>}
            </section>
            <section className="panel quick-panel">
              <div className="panel-heading"><div><h2>Recent enquiries</h2><p>Latest patient messages</p></div><button className="text-button" onClick={() => setSection('enquiries')}>View all</button></div>
              {loading ? <div className="empty-state"><LoaderCircle className="spin" /> Loading...</div> : enquiries.slice(0, 5).length ? <div className="compact-list">{enquiries.slice(0, 5).map(item => <div className="compact-row" key={item.id}><div className="list-avatar"><MessageSquareText size={16} /></div><div className="row-main"><b>{item.patient_name}</b><span>{item.category} · {item.message}</span></div><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span></div>)}</div> : <div className="empty-state">No enquiries yet. Add a sample enquiry to get started.</div>}
            </section>
          </div>
          <section className="panel appointments-preview"><div className="panel-heading"><div><h2>Upcoming appointments</h2><p>Appointments entered by clinic staff</p></div><button className="text-button" onClick={() => setSection('appointments')}>Manage appointments</button></div><AppointmentTable items={appointments.slice(0, 5)} onUpdate={updateAppointment} /></section>
        </>}

        {section === 'enquiries' && <section className="panel">
          <div className="panel-heading"><div><h2>All enquiries</h2><p>{enquiries.length} messages recorded</p></div><div className="search-box"><Search size={16} /><input placeholder="Search enquiries..." value={search} onChange={e => setSearch(e.target.value)} /></div></div>
          <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Message</th><th>Category</th><th>Priority</th><th>Status</th><th>Update</th></tr></thead><tbody>{filteredEnquiries.map(item => <tr key={item.id}><td><b>{item.patient_name}</b><small>#{item.id}</small></td><td className="message-cell">{item.message}<small className="ai-reply">AI draft: {item.ai_reply}</small></td><td>{item.category}</td><td><span className={`priority ${item.priority.toLowerCase()}`}>{item.priority}</span></td><td><span className="status">{item.status}</span></td><td><select value={item.status} onChange={e => updateEnquiry(item.id, e.target.value)}><option>Pending</option><option>Reviewed</option><option>Resolved</option></select></td></tr>)}</tbody></table>{!filteredEnquiries.length && <div className="empty-state">No matching enquiries found.</div>}</div>
        </section>}

        {section === 'appointments' && <div className="content-grid appointment-grid">
          <section className="panel"><div className="panel-heading"><div><h2>New appointment</h2><p>Add an appointment to the clinic schedule.</p></div><span className="section-icon"><Plus size={18} /></span></div>
            <form className="form-stack" onSubmit={submitAppointment}>
              <label>Patient name<input required maxLength="100" placeholder="e.g. Alex Morgan" value={appointmentForm.patient_name} onChange={e => setAppointmentForm({ ...appointmentForm, patient_name: e.target.value })} /></label>
              <div className="two-fields"><label>Date<input required type="date" min={new Date().toISOString().slice(0, 10)} value={appointmentForm.appointment_date} onChange={e => setAppointmentForm({ ...appointmentForm, appointment_date: e.target.value })} /></label><label>Time<input required type="time" value={appointmentForm.appointment_time} onChange={e => setAppointmentForm({ ...appointmentForm, appointment_time: e.target.value })} /></label></div>
              <label>Reason / note <span className="optional">(optional)</span><textarea rows="3" maxLength="300" placeholder="Administrative note only" value={appointmentForm.reason} onChange={e => setAppointmentForm({ ...appointmentForm, reason: e.target.value })} /></label>
              <button className="primary-button" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17} /> : <Plus size={17} />} Add appointment</button>
            </form>
          </section>
          <section className="panel"><div className="panel-heading"><div><h2>Appointment schedule</h2><p>{appointments.length} appointments</p></div></div><AppointmentTable items={appointments} onUpdate={updateAppointment} /></section>
        </div>}

        <footer className="footer-note"><ShieldCheck size={15} /> Demo prototype. Do not enter real patient information. AI output is administrative assistance, not medical advice.</footer>
      </div>
    </main>
  </div>;
}

function AppointmentTable({ items, onUpdate }) {
  if (!items.length) return <div className="empty-state">No appointments added yet.</div>;
  return <div className="table-wrap"><table><thead><tr><th>Patient</th><th>Date</th><th>Time</th><th>Note</th><th>Status</th><th>Update</th></tr></thead><tbody>{items.map(item => <tr key={item.id}><td><b>{item.patient_name}</b><small>#{item.id}</small></td><td>{item.appointment_date}</td><td>{item.appointment_time}</td><td>{item.reason || '—'}</td><td><span className="status">{item.status}</span></td><td><select value={item.status} onChange={e => onUpdate(item.id, e.target.value)}><option>Scheduled</option><option>Completed</option><option>Cancelled</option></select></td></tr>)}</tbody></table></div>;
}

export default App;
