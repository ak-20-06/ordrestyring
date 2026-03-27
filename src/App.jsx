import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock3,
  ImagePlus,
  MapPin,
  RefreshCw,
  Table2,
  User,
  Menu,
  X,
  CheckCircle2,
} from "lucide-react";
import { supabase, KS_BUCKET, hasSupabaseConfig } from "./supabase";

const cityMap = {
  viborg: { x: 38, y: 38 },
  aarhus: { x: 46, y: 45 },
  odense: { x: 57, y: 67 },
  herning: { x: 34, y: 44 },
  silkeborg: { x: 40, y: 43 },
  randers: { x: 48, y: 40 },
  aalborg: { x: 42, y: 22 },
  horsens: { x: 44, y: 49 },
  vejle: { x: 41, y: 54 },
  esbjerg: { x: 24, y: 56 },
  kolding: { x: 38, y: 58 },
  roskilde: { x: 67, y: 73 },
  københavn: { x: 77, y: 73 },
  kobenhavn: { x: 77, y: 73 },
};

const monthsDa = [
  "Januar", "Februar", "Marts", "April", "Maj", "Juni",
  "Juli", "August", "September", "Oktober", "November", "December",
];
const weekdaysDa = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"];

function cn(...classes) { return classes.filter(Boolean).join(" "); }
function parseDate(dateString) { const [y,m,d]=dateString.split("-").map(Number); return new Date(y,m-1,d); }
function formatDateString(date) { const d = new Date(date); d.setMinutes(d.getMinutes()-d.getTimezoneOffset()); return d.toISOString().slice(0,10); }
function addMonths(date, amount) { return new Date(date.getFullYear(), date.getMonth() + amount, 1); }
function getMonthGrid(baseDate) {
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first); start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });
}
function getMonthDays(baseDate) {
  const count = new Date(baseDate.getFullYear(), baseDate.getMonth()+1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(baseDate.getFullYear(), baseDate.getMonth(), i+1));
}
function getWeekStart(date) {
  const d = new Date(date); const weekday = (d.getDay()+6)%7;
  d.setDate(d.getDate()-weekday); d.setHours(0,0,0,0); return d;
}
function getWeekDays(baseDate) {
  const start = getWeekStart(baseDate);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate()+i); return d; });
}
function normalize(text) {
  return String(text || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
function getCoords(address) {
  const text = normalize(address);
  for (const [city, coords] of Object.entries(cityMap)) if (text.includes(city)) return coords;
  return { x: 50, y: 60 };
}
function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh*60+sm; const end = eh*60+em;
  if (end <= start) return 0;
  return (end-start)/60;
}
function sumHours(rows, field) { return rows.reduce((sum,row)=>sum+Number(row[field]||0),0); }
function fmtHours(value) { return Number(value||0).toLocaleString("da-DK",{minimumFractionDigits:0,maximumFractionDigits:2}); }

function Input({ label, className = "", ...props }) {
  return <label className="input-wrap">{label ? <div className="label">{label}</div> : null}<input {...props} className={cn("input", className)} /></label>;
}
function TextArea({ label, className = "", ...props }) {
  return <label className="input-wrap">{label ? <div className="label">{label}</div> : null}<textarea {...props} className={cn("textarea", className)} /></label>;
}
function Button({ children, className = "", active = false, primary = false, ...props }) {
  return <button {...props} className={cn("btn", active && "active", primary && "primary", className)}>{children}</button>;
}
function Card({ children, className = "" }) { return <div className={cn("card", className)}>{children}</div>; }

function SidebarMenu({ active, setActive, onClose }) {
  const items = [
    { id: "kalender", label: "Kalender", icon: CalendarDays },
    { id: "timer", label: "Timer", icon: Clock3 },
    { id: "timeregistrering", label: "Timeregistrering", icon: Table2 },
    { id: "ordrer", label: "Ordrer", icon: ClipboardList },
  ];
  return (
    <div className="menu-list">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button key={item.id} type="button" className={cn("menu-button", active === item.id && "active")} onClick={() => { setActive(item.id); onClose?.(); }}>
            <Icon size={18} /><span>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function App() {
  const todayString = formatDateString(new Date());
  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState(["Asger", "Kasper"]);
  const [selectedProfile, setSelectedProfile] = useState("Asger");
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [timesheetMonth, setTimesheetMonth] = useState(new Date());
  const [activePage, setActivePage] = useState("kalender");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [orders, setOrders] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [dayNotes, setDayNotes] = useState({});
  const [ksFiles, setKsFiles] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const [newOrder, setNewOrder] = useState({
    title: "", customer: "", status: "igang", startDate: "", endDate: "", location: "", address: "", notes: "",
  });
  const [newTime, setNewTime] = useState({ startTime: "07:00", endTime: "15:00", note: "" });

  useEffect(() => {
    const selected = parseDate(selectedDate);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedDate]);

  async function loadAll() {
    if (!hasSupabaseConfig || !supabase) {
      setErrorMessage("Supabase miljøvariabler mangler i Netlify.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setErrorMessage("");
    try {
      const [profilesRes, ordersRes, timeRes, notesRes, filesRes] = await Promise.all([
        supabase.from("profiles").select("*").order("name"),
        supabase.from("orders").select("*").order("created_at", { ascending: false }),
        supabase.from("time_entries").select("*").order("entry_date", { ascending: false }),
        supabase.from("day_notes").select("*"),
        supabase.from("ks_files").select("*").order("created_at", { ascending: false }),
      ]);
      if (profilesRes.error) throw profilesRes.error;
      if (ordersRes.error) throw ordersRes.error;
      if (timeRes.error) throw timeRes.error;
      if (notesRes.error) throw notesRes.error;
      if (filesRes.error) throw filesRes.error;
      if (profilesRes.data?.length) setProfiles(profilesRes.data.map((x) => x.name));
      setOrders(ordersRes.data || []);
      setTimeEntries(timeRes.data || []);
      setKsFiles(filesRes.data || []);
      const noteMap = {};
      (notesRes.data || []).forEach((row) => { noteMap[row.entry_date] = row.note || ""; });
      setDayNotes(noteMap);
    } catch (error) {
      setErrorMessage(error.message || "Kunne ikke hente data fra Supabase.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
    if (!hasSupabaseConfig || !supabase) return;
    const channels = [
      supabase.channel("orders-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadAll).subscribe(),
      supabase.channel("time-live").on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, loadAll).subscribe(),
      supabase.channel("notes-live").on("postgres_changes", { event: "*", schema: "public", table: "day_notes" }, loadAll).subscribe(),
      supabase.channel("profiles-live").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadAll).subscribe(),
      supabase.channel("files-live").on("postgres_changes", { event: "*", schema: "public", table: "ks_files" }, loadAll).subscribe(),
    ];
    return () => { channels.forEach((channel) => supabase.removeChannel(channel)); };
  }, []);

  const selectedDayEntries = useMemo(
    () => timeEntries.filter((row) => row.profile_name === selectedProfile && row.entry_date === selectedDate),
    [timeEntries, selectedProfile, selectedDate]
  );
  const weekStart = getWeekStart(parseDate(selectedDate));
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
  const selectedWeekEntries = useMemo(
    () => timeEntries.filter((row) => {
      const d = parseDate(row.entry_date);
      return row.profile_name === selectedProfile && d >= weekStart && d <= weekEnd;
    }),
    [timeEntries, selectedProfile, weekStart, weekEnd]
  );
  const selectedOrderFiles = useMemo(
    () => ksFiles.filter((row) => row.order_id === selectedOrder?.id),
    [ksFiles, selectedOrder]
  );
  const monthlyRows = useMemo(() => {
    const bucket = {};
    for (const row of timeEntries.filter((x) => x.profile_name === selectedProfile)) {
      const d = parseDate(row.entry_date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      if (!bucket[key]) bucket[key] = { green: 0, red: 0, count: 0 };
      bucket[key].green += Number(row.green_hours || 0);
      bucket[key].red += Number(row.red_hours || 0);
      bucket[key].count += 1;
    }
    return Object.entries(bucket).sort((a,b)=>b[0].localeCompare(a[0])).map(([key,value]) => {
      const [year,month] = key.split("-").map(Number);
      return { key, label: `${monthsDa[month-1]} ${year}`, ...value };
    });
  }, [timeEntries, selectedProfile]);

  async function saveDayNote(value) {
    if (!supabase) return;
    setDayNotes((prev) => ({ ...prev, [selectedDate]: value }));
    const { error } = await supabase.from("day_notes").upsert([{ entry_date: selectedDate, note: value }], { onConflict: "entry_date" });
    if (error) setErrorMessage(error.message);
  }

  async function addTimeEntry() {
    if (!supabase) return;
    const red = calculateHours(newTime.startTime, newTime.endTime);
    if (!selectedProfile || !selectedDate || red <= 0) return;
    const green = Math.min(red, 8);
    const { error } = await supabase.from("time_entries").insert([{
      profile_name: selectedProfile, entry_date: selectedDate, start_time: newTime.startTime,
      end_time: newTime.endTime, green_hours: green, red_hours: red, note: newTime.note,
    }]);
    if (error) { setErrorMessage(error.message); return; }
    setNewTime({ startTime: "07:00", endTime: "15:00", note: "" });
    await loadAll();
  }

  async function addOrder() {
    if (!supabase) return;
    if (!newOrder.title || !newOrder.startDate) return;
    const { error } = await supabase.from("orders").insert([{
      title: newOrder.title, customer: newOrder.customer, status: newOrder.status,
      start_date: newOrder.startDate, end_date: newOrder.endDate || null,
      location: newOrder.location, address: newOrder.address, notes: newOrder.notes,
    }]);
    if (error) { setErrorMessage(error.message); return; }
    setNewOrder({ title: "", customer: "", status: "igang", startDate: "", endDate: "", location: "", address: "", notes: "" });
    await loadAll();
  }

  async function updateSelectedOrder(field, value) {
    if (!supabase || !selectedOrder) return;
    const dbFieldMap = {
      title: "title", customer: "customer", location: "location", address: "address",
      startDate: "start_date", endDate: "end_date", notes: "notes", status: "status",
    };
    const dbField = dbFieldMap[field];
    const next = { ...selectedOrder, [dbField]: value };
    setSelectedOrder(next);
    const { error } = await supabase.from("orders").update({ [dbField]: value || null }).eq("id", selectedOrder.id);
    if (error) setErrorMessage(error.message);
  }

  async function uploadKsFiles(fileList) {
    if (!supabase || !selectedOrder || !fileList?.length) return;
    for (const file of Array.from(fileList)) {
      const filePath = `${selectedOrder.id}/${Date.now()}-${file.name}`;
      const uploadRes = await supabase.storage.from(KS_BUCKET).upload(filePath, file);
      if (uploadRes.error) { setErrorMessage(uploadRes.error.message); return; }
      const { error } = await supabase.from("ks_files").insert([{ order_id: selectedOrder.id, file_name: file.name, file_path: filePath }]);
      if (error) { setErrorMessage(error.message); return; }
    }
    await loadAll();
  }

  function isBooked(dateString) {
    return orders.some((order) => {
      const start = order.start_date;
      const end = order.end_date || order.start_date;
      return dateString >= start && dateString <= end;
    });
  }

  const calculatedRed = calculateHours(newTime.startTime, newTime.endTime);
  const calculatedGreen = Math.min(calculatedRed, 8);

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="mobile-brand">
          <div className="brand-title">Ordrestyring</div>
          <div className="brand-subtitle">Renere version med bedre design</div>
        </div>
        <button className="icon-btn" onClick={() => setMobileMenuOpen((v) => !v)} type="button">
          {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
      </div>

      <div className="layout">
        <aside className={cn("sidebar", mobileMenuOpen && "mobile-open")}>
          <div className="brand-title">Ordrestyring</div>
          <div className="brand-subtitle">Samme funktioner, bedre udtryk</div>
          <SidebarMenu active={activePage} setActive={setActivePage} onClose={() => setMobileMenuOpen(false)} />
          <div className="grid-2-small" style={{ marginTop: 18 }}>
            <div className="stat accent-yellow"><div className="stat-label">Igang</div><div className="stat-value">{orders.filter((o)=>o.status==="igang").length}</div></div>
            <div className="stat accent-blue"><div className="stat-label">Afsluttet</div><div className="stat-value">{orders.filter((o)=>o.status==="afsluttet").length}</div></div>
          </div>
        </aside>

        <main className="content">
          <div className="page-actions">
            <div className="header-chip-row">
              <div className="header-chip"><CalendarDays size={14} /> {selectedDate}</div>
              <div className="header-chip"><User size={14} /> {selectedProfile}</div>
              <div className="header-chip"><ClipboardList size={14} /> {orders.length} sager</div>
            </div>
            <button type="button" onClick={loadAll} className="btn ghost-dark" style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <RefreshCw size={16} /> Opdater
            </button>
          </div>

          {!hasSupabaseConfig ? <div className="error">Supabase miljøvariabler mangler i Netlify.</div> : null}
          {errorMessage ? <div className="error">{errorMessage}</div> : null}

          <div className="grid-4">
            <div className="stat accent-yellow"><div className="stat-top"><div className="stat-icon yellow"><Clock3 size={20} /></div><div><div className="stat-label">Igangværende</div><div className="stat-value">{orders.filter((o)=>o.status==="igang").length}</div></div></div></div>
            <div className="stat accent-blue"><div className="stat-top"><div className="stat-icon blue"><CheckCircle2 size={20} /></div><div><div className="stat-label">Afsluttede</div><div className="stat-value">{orders.filter((o)=>o.status==="afsluttet").length}</div></div></div></div>
            <div className="stat accent-slate"><div className="stat-top"><div className="stat-icon slate"><MapPin size={20} /></div><div><div className="stat-label">Byer</div><div className="stat-value">{new Set(orders.map((o)=>o.location).filter(Boolean)).size}</div></div></div></div>
            <div className="stat accent-green"><div className="stat-top"><div className="stat-icon green"><ClipboardList size={20} /></div><div><div className="stat-label">Sager</div><div className="stat-value">{orders.length}</div></div></div></div>
          </div>

          <div className="grid-2">
            <div className="content">
              <Card>
                <div className="card-toolbar">
                  <div>
                    <div className="section-title"><CalendarDays size={22} /> Kalender</div>
                    <div className="section-subtitle">Samme logik som før, bare mere ryddelig og tydelig.</div>
                  </div>
                  <div className="pill-row"><span className="pill green">Ledig</span><span className="pill red">Booket</span><span className="pill yellow">Weekend</span></div>
                </div>
                <div className="calendar-header">
                  <button type="button" onClick={() => setCalendarMonth((p) => addMonths(p,-1))} className="icon-btn"><ChevronLeft size={18} /></button>
                  <div className="month-title">{monthsDa[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</div>
                  <button type="button" onClick={() => setCalendarMonth((p) => addMonths(p,1))} className="icon-btn"><ChevronRight size={18} /></button>
                </div>
                <div className="calendar-grid" style={{ marginBottom: 8 }}>{weekdaysDa.map((day) => <div key={day} className="weekday">{day}</div>)}</div>
                <div className="calendar-grid">
                  {getMonthGrid(calendarMonth).map((day) => {
                    const dateString = formatDateString(day);
                    const inMonth = day.getMonth() === calendarMonth.getMonth();
                    const weekend = [0,6].includes(day.getDay());
                    const booked = isBooked(dateString);
                    const hours = sumHours(timeEntries.filter((x)=>x.profile_name===selectedProfile && x.entry_date===dateString), "red_hours");
                    return (
                      <button key={dateString} type="button" onClick={() => setSelectedDate(dateString)} className={cn("day-cell", inMonth ? (weekend ? "weekend" : booked ? "booked" : "free") : "outside", selectedDate === dateString && "selected")}>
                        <div className="day-num">{day.getDate()}</div>
                        <div className="day-meta"><div>{weekend ? "Weekend" : booked ? "Booket" : "Ledig"}</div>{hours > 0 ? <div>{fmtHours(hours)} t</div> : null}</div>
                      </button>
                    );
                  })}
                </div>
              </Card>

              <Card>
                <div className="section-title"><Clock3 size={22} /> Timer</div>
                <div className="section-subtitle">Registrér timer hurtigt med tydelige dag- og ugetal.</div>
                <div className="grid-2-small" style={{ marginBottom: 14 }}>
                  {profiles.map((profile) => <Button key={profile} active={selectedProfile===profile} onClick={() => setSelectedProfile(profile)}>{profile}</Button>)}
                </div>
                <div className="summary-box" style={{ marginBottom: 12 }}><div className="small-muted">Valgt dag</div><div style={{ fontSize: 20, fontWeight: 900, marginTop: 4 }}>{selectedDate}</div></div>
                <div className="grid-2-small" style={{ marginBottom: 12 }}>
                  <div className="summary-box"><div className="small-muted">Grøn dag</div><div style={{ color: "#166534", fontSize: 28, fontWeight: 900 }}>{fmtHours(sumHours(selectedDayEntries, "green_hours"))} t</div></div>
                  <div className="summary-box"><div className="small-muted">Rød dag</div><div style={{ color: "#991b1b", fontSize: 28, fontWeight: 900 }}>{fmtHours(sumHours(selectedDayEntries, "red_hours"))} t</div></div>
                </div>
                <div className="grid-2-small" style={{ marginBottom: 14 }}>
                  <div className="summary-box"><div className="small-muted">Grøn uge</div><div style={{ color: "#166534", fontSize: 24, fontWeight: 900 }}>{fmtHours(sumHours(selectedWeekEntries, "green_hours"))} t</div></div>
                  <div className="summary-box"><div className="small-muted">Rød uge</div><div style={{ color: "#991b1b", fontSize: 24, fontWeight: 900 }}>{fmtHours(sumHours(selectedWeekEntries, "red_hours"))} t</div></div>
                </div>
                <div className="grid-2-small" style={{ marginBottom: 12 }}>
                  <Input label="Fra" type="time" value={newTime.startTime} onChange={(e)=>setNewTime({...newTime,startTime:e.target.value})} />
                  <Input label="Til" type="time" value={newTime.endTime} onChange={(e)=>setNewTime({...newTime,endTime:e.target.value})} />
                </div>
                <div className="grid-2-small" style={{ marginBottom: 12 }}>
                  <div className="summary-box"><div className="small-muted">Grøn beregnet</div><div style={{ color: "#166534", fontSize: 24, fontWeight: 900 }}>{fmtHours(calculatedGreen)} t</div></div>
                  <div className="summary-box"><div className="small-muted">Rød beregnet</div><div style={{ color: "#991b1b", fontSize: 24, fontWeight: 900 }}>{fmtHours(calculatedRed)} t</div></div>
                </div>
                <Input label="Note" value={newTime.note} onChange={(e)=>setNewTime({...newTime,note:e.target.value})} />
                <div style={{ height: 12 }} />
                <Button primary className="block" onClick={addTimeEntry}>Tilføj timer</Button>
              </Card>

              <Card>
                <div className="section-title"><Table2 size={22} /> Timeregistrering</div>
                <div className="section-subtitle">Månedsliste og ugevisning som er lettere at aflæse på store projekter.</div>
                <div className="calendar-header">
                  <button type="button" onClick={() => setTimesheetMonth((p)=>addMonths(p,-1))} className="icon-btn"><ChevronLeft size={18} /></button>
                  <div className="month-title" style={{ fontSize: 20 }}>{monthsDa[timesheetMonth.getMonth()]} {timesheetMonth.getFullYear()}</div>
                  <button type="button" onClick={() => setTimesheetMonth((p)=>addMonths(p,1))} className="icon-btn"><ChevronRight size={18} /></button>
                </div>
                <div className="order-list" style={{ marginBottom: 16 }}>
                  {getMonthDays(timesheetMonth).map((day) => {
                    const dateString = formatDateString(day);
                    const rows = timeEntries.filter((x)=>x.entry_date===dateString);
                    return (
                      <div key={dateString} className="order-item" style={{ cursor: "default" }}>
                        <div className="order-top">
                          <div><div className="order-title">{weekdaysDa[(day.getDay()+6)%7]} {day.getDate()}/{day.getMonth()+1}</div><div className="order-meta">Registreringer: {rows.length}</div></div>
                          <div className="pill-row"><span className="pill green">Grøn {fmtHours(sumHours(rows,"green_hours"))} t</span><span className="pill red">Rød {fmtHours(sumHours(rows,"red_hours"))} t</span></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="table-wrap">
                  <div className="week-table">
                    <div className="week-head">
                      <div className="week-cell">Navn</div>
                      {getWeekDays(timesheetMonth).map((day) => {
                        const ds = formatDateString(day);
                        return <div key={ds} className="week-cell"><div style={{ fontWeight: 800 }}>{weekdaysDa[(day.getDay()+6)%7]}</div><div className="small-muted">{day.getDate()}/{day.getMonth()+1}</div></div>;
                      })}
                    </div>
                    {profiles.map((profile) => (
                      <div key={profile} className="week-row">
                        <div className="week-cell" style={{ fontWeight: 800 }}>{profile}</div>
                        {getWeekDays(timesheetMonth).map((day) => {
                          const ds = formatDateString(day);
                          const rows = timeEntries.filter((x)=>x.profile_name===profile && x.entry_date===ds);
                          return (
                            <div key={`${profile}-${ds}`} className="week-cell">
                              <div className="status-box green">Grøn {fmtHours(sumHours(rows,"green_hours"))}</div>
                              <div className="status-box red">Rød {fmtHours(sumHours(rows,"red_hours"))}</div>
                            </div>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            </div>

            <div className="content">
              <Card>
                <div className="card-toolbar">
                  <div><div className="section-title"><MapPin size={22} /> Danmarkskort</div><div className="section-subtitle">Klik på en prik for at åbne ordren.</div></div>
                  <div className="pill-row"><span className="pill yellow">Igang</span><span className="pill blue">Afsluttet</span></div>
                </div>
                <div className="map-box">
                  <img src="/denmark-map.png" alt="Danmarkskort" />
                  {orders.map((order) => {
                    const coords = getCoords(order.address || order.location);
                    const isDone = order.status === "afsluttet";
                    return <button type="button" key={order.id} onClick={() => setSelectedOrder(order)} className={cn("map-pin", isDone ? "done" : "active")} style={{ left: `${coords.x}%`, top: `${coords.y}%` }} title={order.title} />;
                  })}
                </div>
              </Card>

              <Card>
                <div className="section-title"><ClipboardList size={22} /> Opret ordre</div>
                <div className="section-subtitle">Renere formular med de samme funktioner.</div>
                <Input label="Sagsnavn" value={newOrder.title} onChange={(e)=>setNewOrder({...newOrder,title:e.target.value})} />
                <div style={{ height: 12 }} />
                <Input label="Kunde" value={newOrder.customer} onChange={(e)=>setNewOrder({...newOrder,customer:e.target.value})} />
                <div style={{ height: 12 }} />
                <Input label="By / lokation" value={newOrder.location} onChange={(e)=>setNewOrder({...newOrder,location:e.target.value})} />
                <div style={{ height: 12 }} />
                <Input label="Adresse" value={newOrder.address} onChange={(e)=>setNewOrder({...newOrder,address:e.target.value})} />
                <div style={{ height: 12 }} />
                <TextArea label="Noter" value={newOrder.notes} onChange={(e)=>setNewOrder({...newOrder,notes:e.target.value})} />
                <div style={{ height: 12 }} />
                <div className="grid-2-small">
                  <Input label="Startdato" type="date" value={newOrder.startDate} onChange={(e)=>setNewOrder({...newOrder,startDate:e.target.value})} />
                  <Input label="Slutdato" type="date" value={newOrder.endDate} onChange={(e)=>setNewOrder({...newOrder,endDate:e.target.value})} />
                </div>
                <div style={{ height: 12 }} />
                <div className="grid-2-small">
                  <Button active={newOrder.status==="igang"} onClick={() => setNewOrder({...newOrder,status:"igang"})}>Igangværende</Button>
                  <Button active={newOrder.status==="afsluttet"} onClick={() => setNewOrder({...newOrder,status:"afsluttet"})}>Afsluttet</Button>
                </div>
                <div style={{ height: 12 }} />
                <Button primary className="block" onClick={addOrder}>Tilføj ordre</Button>
              </Card>

              <Card>
                <div className="section-title"><ClipboardList size={22} /> Månedsoverblik</div>
                <div className="section-subtitle">Timer for den valgte profil: {selectedProfile}</div>
                <div className="order-list">
                  {monthlyRows.map((row) => (
                    <div key={row.key} className="order-item" style={{ cursor: "default" }}>
                      <div className="order-title">{row.label}</div>
                      <div className="pill-row" style={{ marginTop: 10 }}>
                        <span className="pill green">Grøn {fmtHours(row.green)} t</span>
                        <span className="pill red">Rød {fmtHours(row.red)} t</span>
                        <span className="pill blue">Reg.: {row.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              {selectedOrder ? (
                <Card>
                  <div className="card-toolbar">
                    <div><div className="section-title"><ClipboardList size={22} /> Valgt ordre</div><div className="section-subtitle">Her kan du rette adresse, noter og KS.</div></div>
                    <button type="button" className="icon-btn" onClick={() => setSelectedOrder(null)}><X size={18} /></button>
                  </div>
                  <Input label="Sagsnavn" value={selectedOrder.title || ""} onChange={(e)=>updateSelectedOrder("title", e.target.value)} />
                  <div style={{ height: 12 }} />
                  <Input label="Kunde" value={selectedOrder.customer || ""} onChange={(e)=>updateSelectedOrder("customer", e.target.value)} />
                  <div style={{ height: 12 }} />
                  <Input label="Lokation" value={selectedOrder.location || ""} onChange={(e)=>updateSelectedOrder("location", e.target.value)} />
                  <div style={{ height: 12 }} />
                  <Input label="Adresse" value={selectedOrder.address || ""} onChange={(e)=>updateSelectedOrder("address", e.target.value)} />
                  <div style={{ height: 12 }} />
                  <div className="grid-2-small">
                    <Input label="Startdato" type="date" value={selectedOrder.start_date || ""} onChange={(e)=>updateSelectedOrder("startDate", e.target.value)} />
                    <Input label="Slutdato" type="date" value={selectedOrder.end_date || ""} onChange={(e)=>updateSelectedOrder("endDate", e.target.value)} />
                  </div>
                  <div style={{ height: 12 }} />
                  <TextArea label="Noter / tekst" value={selectedOrder.notes || ""} onChange={(e)=>updateSelectedOrder("notes", e.target.value)} />
                  <div style={{ height: 14 }} />
                  <div className="summary-box">
                    <div className="section-title" style={{ fontSize: 18, marginBottom: 12 }}><ImagePlus size={18} /> KS upload</div>
                    <input type="file" multiple onChange={(e)=>uploadKsFiles(e.target.files)} />
                    <div className="order-list" style={{ marginTop: 12 }}>
                      {selectedOrderFiles.length === 0 ? (
                        <div className="small-muted">Ingen KS filer endnu.</div>
                      ) : (
                        selectedOrderFiles.map((file) => (
                          <div key={file.id} className="order-item" style={{ cursor: "default", padding: 14 }}>
                            <div className="order-title" style={{ fontSize: 15 }}>{file.file_name}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </Card>
              ) : null}

              <Card>
                <div className="section-title"><ClipboardList size={22} /> Eksisterende ordrer</div>
                <div className="section-subtitle">Tryk på en ordre for at åbne den.</div>
                <div className="order-list">
                  {orders.map((order) => (
                    <button key={order.id} type="button" onClick={() => setSelectedOrder(order)} className="order-item">
                      <div className="order-top">
                        <div>
                          <div className="order-title">{order.title}</div>
                          <div className="order-meta">{order.customer || "Ingen kunde"} · {order.location || "Ingen lokation"}</div>
                          <div className="order-meta">{order.address || "Ingen adresse"}</div>
                          <div className="order-meta">{order.start_date} → {order.end_date || "Ikke sat"}</div>
                        </div>
                        <div className="pill-row"><span className={cn("pill", order.status === "afsluttet" ? "blue" : "yellow")}>{order.status === "afsluttet" ? "Afsluttet" : "Igang"}</span></div>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          {loading ? <div className="loading">Henter data fra Supabase…</div> : null}
        </main>
      </div>
    </div>
  );
}
