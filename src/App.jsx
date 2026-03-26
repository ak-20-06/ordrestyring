
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
} from "lucide-react";
import { supabase, KS_BUCKET } from "./supabase";

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

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function parseDate(dateString) {
  const [y, m, d] = dateString.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateString(date) {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 10);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getMonthGrid(baseDate) {
  const first = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - startOffset);
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function getMonthDays(baseDate) {
  const count = new Date(baseDate.getFullYear(), baseDate.getMonth() + 1, 0).getDate();
  return Array.from({ length: count }, (_, i) => new Date(baseDate.getFullYear(), baseDate.getMonth(), i + 1));
}

function getWeekStart(date) {
  const d = new Date(date);
  const weekday = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - weekday);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekDays(baseDate) {
  const start = getWeekStart(baseDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function normalize(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getCoords(address) {
  const text = normalize(address);
  for (const [city, coords] of Object.entries(cityMap)) {
    if (text.includes(city)) return coords;
  }
  return { x: 50, y: 60 };
}

function calculateHours(startTime, endTime) {
  if (!startTime || !endTime) return 0;
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  const start = sh * 60 + sm;
  const end = eh * 60 + em;
  if (end <= start) return 0;
  return (end - start) / 60;
}

function sumHours(rows, field) {
  return rows.reduce((sum, row) => sum + Number(row[field] || 0), 0);
}

function fmtHours(value) {
  return Number(value || 0).toLocaleString("da-DK", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function Input({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label ? <div className="text-sm text-slate-600 mb-2">{label}</div> : null}
      <input
        {...props}
        className={cn(
          "w-full h-12 rounded-2xl border border-slate-200 bg-white px-4 outline-none focus:border-slate-400",
          className
        )}
      />
    </label>
  );
}

function Button({ children, className = "", active = false, ...props }) {
  return (
    <button
      {...props}
      className={cn(
        "h-12 rounded-2xl px-4 text-sm font-medium transition",
        active ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-800 hover:border-slate-300",
        className
      )}
    >
      {children}
    </button>
  );
}

function Card({ children, className = "" }) {
  return <div className={cn("rounded-[28px] bg-white shadow-lg border border-slate-100", className)}>{children}</div>;
}

export default function App() {
  const todayString = formatDateString(new Date());

  const [loading, setLoading] = useState(true);
  const [profiles, setProfiles] = useState(["Asger", "Kasper"]);
  const [selectedProfile, setSelectedProfile] = useState("Asger");
  const [selectedDate, setSelectedDate] = useState(todayString);
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [timesheetMonth, setTimesheetMonth] = useState(new Date());

  const [orders, setOrders] = useState([]);
  const [timeEntries, setTimeEntries] = useState([]);
  const [dayNotes, setDayNotes] = useState({});
  const [ksFiles, setKsFiles] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);

  const [newOrder, setNewOrder] = useState({
    title: "",
    customer: "",
    status: "igang",
    startDate: "",
    endDate: "",
    location: "",
    address: "",
    notes: "",
  });

  const [newTime, setNewTime] = useState({
    startTime: "07:00",
    endTime: "15:00",
    note: "",
  });

  useEffect(() => {
    const selected = parseDate(selectedDate);
    setCalendarMonth(new Date(selected.getFullYear(), selected.getMonth(), 1));
  }, [selectedDate]);

  async function loadAll() {
    setLoading(true);
    const [profilesRes, ordersRes, timeRes, notesRes, filesRes] = await Promise.all([
      supabase.from("profiles").select("*").order("name"),
      supabase.from("orders").select("*").order("created_at", { ascending: false }),
      supabase.from("time_entries").select("*").order("entry_date", { ascending: false }),
      supabase.from("day_notes").select("*"),
      supabase.from("ks_files").select("*").order("created_at", { ascending: false }),
    ]);

    if (profilesRes.data?.length) setProfiles(profilesRes.data.map((x) => x.name));
    setOrders(ordersRes.data || []);
    setTimeEntries(timeRes.data || []);
    setKsFiles(filesRes.data || []);

    const noteMap = {};
    (notesRes.data || []).forEach((row) => {
      noteMap[row.entry_date] = row.note || "";
    });
    setDayNotes(noteMap);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();

    const channels = [
      supabase.channel("orders-live").on("postgres_changes", { event: "*", schema: "public", table: "orders" }, loadAll).subscribe(),
      supabase.channel("time-live").on("postgres_changes", { event: "*", schema: "public", table: "time_entries" }, loadAll).subscribe(),
      supabase.channel("notes-live").on("postgres_changes", { event: "*", schema: "public", table: "day_notes" }, loadAll).subscribe(),
      supabase.channel("profiles-live").on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, loadAll).subscribe(),
      supabase.channel("files-live").on("postgres_changes", { event: "*", schema: "public", table: "ks_files" }, loadAll).subscribe(),
    ];

    return () => {
      channels.forEach((channel) => supabase.removeChannel(channel));
    };
  }, []);

  const selectedDayEntries = useMemo(
    () => timeEntries.filter((row) => row.profile_name === selectedProfile && row.entry_date === selectedDate),
    [timeEntries, selectedProfile, selectedDate]
  );

  const weekStart = getWeekStart(parseDate(selectedDate));
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const selectedWeekEntries = useMemo(
    () =>
      timeEntries.filter((row) => {
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
    return Object.entries(bucket)
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([key, value]) => {
        const [year, month] = key.split("-").map(Number);
        return { key, label: `${monthsDa[month - 1]} ${year}`, ...value };
      });
  }, [timeEntries, selectedProfile]);

  async function saveDayNote(value) {
    setDayNotes((prev) => ({ ...prev, [selectedDate]: value }));
    await supabase
      .from("day_notes")
      .upsert([{ entry_date: selectedDate, note: value }], { onConflict: "entry_date" });
  }

  async function addTimeEntry() {
    const red = calculateHours(newTime.startTime, newTime.endTime);
    if (!selectedProfile || !selectedDate || red <= 0) return;
    const green = Math.min(red, 8);
    await supabase.from("time_entries").insert([
      {
        profile_name: selectedProfile,
        entry_date: selectedDate,
        start_time: newTime.startTime,
        end_time: newTime.endTime,
        green_hours: green,
        red_hours: red,
        note: newTime.note,
      },
    ]);
    setNewTime({ startTime: "07:00", endTime: "15:00", note: "" });
    await loadAll();
  }

  async function addOrder() {
    if (!newOrder.title || !newOrder.startDate) return;
    await supabase.from("orders").insert([
      {
        title: newOrder.title,
        customer: newOrder.customer,
        status: newOrder.status,
        start_date: newOrder.startDate,
        end_date: newOrder.endDate || null,
        location: newOrder.location,
        address: newOrder.address,
        notes: newOrder.notes,
      },
    ]);
    setNewOrder({
      title: "",
      customer: "",
      status: "igang",
      startDate: "",
      endDate: "",
      location: "",
      address: "",
      notes: "",
    });
    await loadAll();
  }

  async function updateSelectedOrder(field, value) {
    if (!selectedOrder) return;
    const dbFieldMap = {
      title: "title",
      customer: "customer",
      location: "location",
      address: "address",
      startDate: "start_date",
      endDate: "end_date",
      notes: "notes",
      status: "status",
    };
    const dbField = dbFieldMap[field];
    const next = { ...selectedOrder, [dbField]: value };
    setSelectedOrder(next);
    await supabase.from("orders").update({ [dbField]: value || null }).eq("id", selectedOrder.id);
  }

  async function uploadKsFiles(fileList) {
    if (!selectedOrder || !fileList?.length) return;
    for (const file of Array.from(fileList)) {
      const filePath = `${selectedOrder.id}/${Date.now()}-${file.name}`;
      const uploadRes = await supabase.storage.from(KS_BUCKET).upload(filePath, file);
      if (!uploadRes.error) {
        await supabase.from("ks_files").insert([
          {
            order_id: selectedOrder.id,
            file_name: file.name,
            file_path: filePath,
          },
        ]);
      }
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
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="max-w-7xl mx-auto p-3 sm:p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
          <Card className="p-5 h-fit lg:sticky lg:top-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-2xl font-bold">Ordrestyring</div>
                <div className="text-sm text-slate-500 mt-1">Ny ren version</div>
              </div>
              <button
                type="button"
                onClick={loadAll}
                className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center"
                title="Opdater"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-5 space-y-3">
              <Button className="w-full justify-start text-left flex items-center gap-3"><CalendarDays className="w-4 h-4" /> Kalender</Button>
              <Button className="w-full justify-start text-left flex items-center gap-3"><Clock3 className="w-4 h-4" /> Timer</Button>
              <Button className="w-full justify-start text-left flex items-center gap-3"><Table2 className="w-4 h-4" /> Timeregistrering</Button>
              <Button className="w-full justify-start text-left flex items-center gap-3"><ClipboardList className="w-4 h-4" /> Ordrer</Button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-yellow-100 p-3">
                <div className="text-xs text-slate-600">Igang</div>
                <div className="text-xl font-bold">{orders.filter((o) => o.status === "igang").length}</div>
              </div>
              <div className="rounded-2xl bg-blue-100 p-3">
                <div className="text-xs text-slate-600">Afsluttet</div>
                <div className="text-xl font-bold">{orders.filter((o) => o.status === "afsluttet").length}</div>
              </div>
            </div>
          </Card>

          <div className="space-y-4">
            <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_0.9fr] gap-4">
              <div className="space-y-4">
                <Card className="p-5">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <button type="button" onClick={() => setCalendarMonth((p) => addMonths(p, -1))} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="text-center">
                      <div className="text-sm text-slate-500">Måned</div>
                      <div className="font-bold text-xl">{monthsDa[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}</div>
                    </div>
                    <button type="button" onClick={() => setCalendarMonth((p) => addMonths(p, 1))} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                  </div>

                  <div className="grid grid-cols-7 gap-2 mb-2">
                    {weekdaysDa.map((day) => <div key={day} className="text-center text-xs font-semibold text-slate-500">{day}</div>)}
                  </div>

                  <div className="grid grid-cols-7 gap-2">
                    {getMonthGrid(calendarMonth).map((day) => {
                      const dateString = formatDateString(day);
                      const inMonth = day.getMonth() === calendarMonth.getMonth();
                      const weekend = [0, 6].includes(day.getDay());
                      const booked = isBooked(dateString);
                      const hours = sumHours(timeEntries.filter((x) => x.profile_name === selectedProfile && x.entry_date === dateString), "red_hours");
                      return (
                        <button
                          key={dateString}
                          type="button"
                          onClick={() => setSelectedDate(dateString)}
                          className={cn(
                            "min-h-[90px] rounded-2xl border p-2 text-left flex flex-col justify-between transition",
                            inMonth ? (weekend ? "bg-amber-300 border-amber-300" : booked ? "bg-red-500 border-red-500 text-white" : "bg-green-500 border-green-500 text-white")
                                    : "bg-slate-200 border-slate-200 text-slate-600",
                            selectedDate === dateString && "ring-4 ring-slate-900/25"
                          )}
                        >
                          <div className="font-bold text-lg">{day.getDate()}</div>
                          <div className="text-[11px]">
                            <div>{weekend ? "Weekend" : booked ? "Booket" : "Ledig"}</div>
                            {hours > 0 ? <div>{fmtHours(hours)} t</div> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="text-lg font-bold mb-2">Dagstekst</div>
                  <Input
                    label={`Tekst for ${selectedDate}`}
                    value={dayNotes[selectedDate] || ""}
                    onChange={(e) => saveDayNote(e.target.value)}
                    placeholder="Skriv hvad der skal ske den dag"
                  />
                </Card>

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4"><Clock3 className="w-5 h-5" /><div className="text-xl font-bold">Timer</div></div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {profiles.map((profile) => (
                      <Button key={profile} active={selectedProfile === profile} onClick={() => setSelectedProfile(profile)} className="flex items-center justify-center gap-2">
                        <User className="w-4 h-4" />{profile}
                      </Button>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 mb-4">
                    <div className="text-sm text-slate-500">Valgt dag</div>
                    <div className="font-semibold text-lg">{selectedDate}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                      <div className="text-sm text-slate-600">Grøn dag</div>
                      <div className="text-2xl font-bold text-green-700">{fmtHours(sumHours(selectedDayEntries, "green_hours"))} t</div>
                    </div>
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                      <div className="text-sm text-slate-600">Rød dag</div>
                      <div className="text-2xl font-bold text-red-700">{fmtHours(sumHours(selectedDayEntries, "red_hours"))} t</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                      <div className="text-sm text-slate-600">Grøn uge</div>
                      <div className="text-2xl font-bold text-green-700">{fmtHours(sumHours(selectedWeekEntries, "green_hours"))} t</div>
                    </div>
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                      <div className="text-sm text-slate-600">Rød uge</div>
                      <div className="text-2xl font-bold text-red-700">{fmtHours(sumHours(selectedWeekEntries, "red_hours"))} t</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <Input label="Fra" type="time" value={newTime.startTime} onChange={(e) => setNewTime({ ...newTime, startTime: e.target.value })} />
                    <Input label="Til" type="time" value={newTime.endTime} onChange={(e) => setNewTime({ ...newTime, endTime: e.target.value })} />
                  </div>

                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="rounded-2xl bg-green-50 border border-green-200 p-4">
                      <div className="text-sm text-slate-600">Grøn beregnet</div>
                      <div className="text-2xl font-bold text-green-700">{fmtHours(calculatedGreen)} t</div>
                    </div>
                    <div className="rounded-2xl bg-red-50 border border-red-200 p-4">
                      <div className="text-sm text-slate-600">Rød beregnet</div>
                      <div className="text-2xl font-bold text-red-700">{fmtHours(calculatedRed)} t</div>
                    </div>
                  </div>

                  <Input label="Note" value={newTime.note} onChange={(e) => setNewTime({ ...newTime, note: e.target.value })} className="mb-3" />
                  <Button active className="w-full" onClick={addTimeEntry}>Tilføj timer</Button>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4"><Table2 className="w-5 h-5" /><div className="text-xl font-bold">Timeregistrering</div></div>

                  <div className="flex items-center justify-between gap-3 mb-4">
                    <button type="button" onClick={() => setTimesheetMonth((p) => addMonths(p, -1))} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center"><ChevronLeft className="w-4 h-4" /></button>
                    <div className="font-bold">{monthsDa[timesheetMonth.getMonth()]} {timesheetMonth.getFullYear()}</div>
                    <button type="button" onClick={() => setTimesheetMonth((p) => addMonths(p, 1))} className="h-11 w-11 rounded-2xl border border-slate-200 bg-white flex items-center justify-center"><ChevronRight className="w-4 h-4" /></button>
                  </div>

                  <div className="space-y-3 mb-5">
                    {getMonthDays(timesheetMonth).map((day) => {
                      const dateString = formatDateString(day);
                      const rows = timeEntries.filter((x) => x.entry_date === dateString);
                      return (
                        <div key={dateString} className="rounded-2xl border border-slate-200 p-4">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <div>
                              <div className="font-semibold">{weekdaysDa[(day.getDay() + 6) % 7]} {day.getDate()}/{day.getMonth() + 1}</div>
                              <div className="text-sm text-slate-500">Registreringer: {rows.length}</div>
                            </div>
                            <div className="flex gap-2 flex-wrap">
                              <div className="rounded-xl bg-green-100 text-green-700 px-3 py-2 text-sm font-medium">Grøn {fmtHours(sumHours(rows, "green_hours"))} t</div>
                              <div className="rounded-xl bg-red-100 text-red-700 px-3 py-2 text-sm font-medium">Rød {fmtHours(sumHours(rows, "red_hours"))} t</div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="overflow-x-auto">
                    <div className="min-w-[860px] rounded-2xl border border-slate-200 overflow-hidden">
                      <div className="grid grid-cols-8 bg-slate-100">
                        <div className="p-3 font-semibold text-slate-700">Navn</div>
                        {getWeekDays(timesheetMonth).map((day) => {
                          const ds = formatDateString(day);
                          return (
                            <div key={ds} className="p-3 border-l border-slate-200">
                              <div className="font-semibold">{weekdaysDa[(day.getDay() + 6) % 7]}</div>
                              <div className="text-sm text-slate-500">{day.getDate()}/{day.getMonth() + 1}</div>
                            </div>
                          );
                        })}
                      </div>
                      {profiles.map((profile) => (
                        <div key={profile} className="grid grid-cols-8 bg-white border-t border-slate-200">
                          <div className="p-3 font-semibold">{profile}</div>
                          {getWeekDays(timesheetMonth).map((day) => {
                            const ds = formatDateString(day);
                            const rows = timeEntries.filter((x) => x.profile_name === profile && x.entry_date === ds);
                            return (
                              <div key={`${profile}-${ds}`} className="p-2 border-l border-slate-200">
                                <div className="rounded-xl bg-green-50 border border-green-200 px-2 py-1 text-xs text-green-700 font-medium mb-1">Grøn {fmtHours(sumHours(rows, "green_hours"))}</div>
                                <div className="rounded-xl bg-red-50 border border-red-200 px-2 py-1 text-xs text-red-700 font-medium">Rød {fmtHours(sumHours(rows, "red_hours"))}</div>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4"><ClipboardList className="w-5 h-5" /><div className="text-xl font-bold">Timer pr. måned</div></div>
                  <div className="space-y-3">
                    {monthlyRows.map((row) => (
                      <div key={row.key} className="rounded-2xl border border-slate-200 p-4">
                        <div className="font-semibold">{row.label}</div>
                        <div className="grid grid-cols-2 gap-3 mt-3">
                          <div className="rounded-2xl bg-green-50 border border-green-200 p-3">
                            <div className="text-sm text-slate-600">Grøn</div>
                            <div className="text-xl font-bold text-green-700">{fmtHours(row.green)} t</div>
                          </div>
                          <div className="rounded-2xl bg-red-50 border border-red-200 p-3">
                            <div className="text-sm text-slate-600">Rød</div>
                            <div className="text-xl font-bold text-red-700">{fmtHours(row.red)} t</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>

              <div className="space-y-4">
                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4"><MapPin className="w-5 h-5" /><div className="text-xl font-bold">Danmarkskort</div></div>
                  <div className="relative h-[420px] rounded-2xl border overflow-hidden bg-white">
                    <img src="/denmark-map.png" alt="Danmarkskort" className="absolute inset-0 w-full h-full object-contain" />
                    {orders.map((order) => {
                      const coords = getCoords(order.address || order.location);
                      const isDone = order.status === "afsluttet";
                      return (
                        <button
                          type="button"
                          key={order.id}
                          onClick={() => setSelectedOrder(order)}
                          className="absolute -translate-x-1/2 -translate-y-1/2"
                          style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                          title={order.title}
                        >
                          <div className={cn("w-5 h-5 rounded-full shadow ring-4", isDone ? "bg-blue-600 ring-blue-200" : "bg-yellow-400 ring-yellow-200")} />
                        </button>
                      );
                    })}
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="flex items-center gap-2 mb-4"><ClipboardList className="w-5 h-5" /><div className="text-xl font-bold">Opret ordre</div></div>
                  <div className="space-y-3">
                    <Input label="Sagsnavn" value={newOrder.title} onChange={(e) => setNewOrder({ ...newOrder, title: e.target.value })} />
                    <Input label="Kunde" value={newOrder.customer} onChange={(e) => setNewOrder({ ...newOrder, customer: e.target.value })} />
                    <Input label="By / lokation" value={newOrder.location} onChange={(e) => setNewOrder({ ...newOrder, location: e.target.value })} />
                    <Input label="Adresse" value={newOrder.address} onChange={(e) => setNewOrder({ ...newOrder, address: e.target.value })} />
                    <label className="block">
                      <div className="text-sm text-slate-600 mb-2">Noter</div>
                      <textarea
                        value={newOrder.notes}
                        onChange={(e) => setNewOrder({ ...newOrder, notes: e.target.value })}
                        className="w-full min-h-[100px] rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                      />
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <Input label="Startdato" type="date" value={newOrder.startDate} onChange={(e) => setNewOrder({ ...newOrder, startDate: e.target.value })} />
                      <Input label="Slutdato" type="date" value={newOrder.endDate} onChange={(e) => setNewOrder({ ...newOrder, endDate: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Button active={newOrder.status === "igang"} onClick={() => setNewOrder({ ...newOrder, status: "igang" })}>Igangværende</Button>
                      <Button active={newOrder.status === "afsluttet"} onClick={() => setNewOrder({ ...newOrder, status: "afsluttet" })}>Afsluttet</Button>
                    </div>
                    <Button active className="w-full" onClick={addOrder}>Tilføj ordre</Button>
                  </div>
                </Card>

                {selectedOrder ? (
                  <Card className="p-5">
                    <div className="flex items-center justify-between gap-3 mb-4">
                      <div className="text-xl font-bold">Valgt ordre</div>
                      <button type="button" onClick={() => setSelectedOrder(null)} className="h-10 px-3 rounded-xl border border-slate-200 bg-white text-sm">Luk</button>
                    </div>

                    <div className="space-y-3">
                      <Input label="Sagsnavn" value={selectedOrder.title || ""} onChange={(e) => updateSelectedOrder("title", e.target.value)} />
                      <Input label="Kunde" value={selectedOrder.customer || ""} onChange={(e) => updateSelectedOrder("customer", e.target.value)} />
                      <Input label="Lokation" value={selectedOrder.location || ""} onChange={(e) => updateSelectedOrder("location", e.target.value)} />
                      <Input label="Adresse" value={selectedOrder.address || ""} onChange={(e) => updateSelectedOrder("address", e.target.value)} />
                      <div className="grid grid-cols-2 gap-3">
                        <Input label="Startdato" type="date" value={selectedOrder.start_date || ""} onChange={(e) => updateSelectedOrder("startDate", e.target.value)} />
                        <Input label="Slutdato" type="date" value={selectedOrder.end_date || ""} onChange={(e) => updateSelectedOrder("endDate", e.target.value)} />
                      </div>
                      <label className="block">
                        <div className="text-sm text-slate-600 mb-2">Noter / tekst</div>
                        <textarea
                          value={selectedOrder.notes || ""}
                          onChange={(e) => updateSelectedOrder("notes", e.target.value)}
                          className="w-full min-h-[120px] rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none focus:border-slate-400"
                        />
                      </label>

                      <div className="rounded-2xl border border-slate-200 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <ImagePlus className="w-5 h-5" />
                          <div className="font-bold text-lg">KS upload</div>
                        </div>
                        <input type="file" multiple onChange={(e) => uploadKsFiles(e.target.files)} className="block w-full text-sm" />
                        <div className="mt-3 space-y-2">
                          {selectedOrderFiles.length === 0 ? (
                            <div className="text-sm text-slate-500">Ingen KS filer endnu.</div>
                          ) : (
                            selectedOrderFiles.map((file) => (
                              <div key={file.id} className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 text-sm text-slate-700">
                                {file.file_name}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                ) : null}

                <Card className="p-5">
                  <div className="text-xl font-bold mb-4">Eksisterende ordrer</div>
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="w-full text-left rounded-2xl border border-slate-200 p-4 hover:border-slate-400 transition"
                      >
                        <div className="font-semibold">{order.title}</div>
                        <div className="text-sm text-slate-500 mt-1">{order.customer || "Ingen kunde"} · {order.location || "Ingen lokation"}</div>
                        <div className="text-sm text-slate-500 mt-1">{order.address || "Ingen adresse"}</div>
                        <div className="text-sm text-slate-500 mt-1">{order.start_date} → {order.end_date || "Ikke sat"}</div>
                      </button>
                    ))}
                  </div>
                </Card>
              </div>
            </div>

            {loading ? <div className="text-sm text-slate-500">Henter data fra Supabase…</div> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
