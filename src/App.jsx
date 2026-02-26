import { useState, useEffect, useRef } from "react";

// ─── Supabase client ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://gzimacledflvreoqxsfn.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd6aW1hY2xlZGZsdnJlb3F4c2ZuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5MzYzMzksImV4cCI6MjA4NzUxMjMzOX0.55NCtl8QcXjUddyy3JL4NUalHXCDTBWThWOb1WYhgI4";

const sbHeaders = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_KEY,
  "Authorization": `Bearer ${SUPABASE_KEY}`,
};

async function sbGet(table, params = "") {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, { headers: sbHeaders });
  if (!res.ok) return null;
  return res.json();
}
async function sbUpsert(table, data) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: "POST",
    headers: { ...sbHeaders, "Prefer": "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(data),
  });
  return res.ok;
}
async function sbDelete(table, params) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}${params}`, {
    method: "DELETE",
    headers: sbHeaders,
  });
  return res.ok;
}// ============================================================
// CONSTANTS & DATA
// ============================================================
const MEMBERS = ["Mylene", "Migo", "Miggy", "Dani"];
const MEMBER_COLORS = {
  Mylene: "#FF6B9D",
  Migo: "#4ECDC4",
  Miggy: "#45B7D1",
  Dani: "#96CEB4",
};
const AVATAR_OPTIONS = ["🐱","🐶","🦊","🐼","🐨","🦁","🐯","🐸","🦋","🌸","⭐","🌈","🎀","🎸","🚀","🍕"];

const DEFAULT_CHECKLIST = [
  { id: "c1", text: "Book flights", checked_by: [], category: "travel" },
  { id: "c2", text: "Book accommodation", checked_by: [], category: "travel" },
  { id: "c3", text: "Travel insurance", checked_by: [], category: "travel" },
  { id: "c4", text: "Passport valid 6+ months", checked_by: [], category: "documents" },
  { id: "c5", text: "Visa requirements", checked_by: [], category: "documents" },
  { id: "c6", text: "Pack clothes", checked_by: [], category: "packing" },
  { id: "c7", text: "Toiletries", checked_by: [], category: "packing" },
  { id: "c8", text: "Phone charger & adapters", checked_by: [], category: "packing" },
];

// ============================================================
// SUPABASE-AWARE SESSION HELPERS (session stays local)
// ============================================================
function saveSession(tripId, member) {
  localStorage.setItem("wb2_session", JSON.stringify({ tripId, member }));
}
function loadSession() {
  try { return JSON.parse(localStorage.getItem("wb2_session")); } catch { return null; }
}
function clearSession() {
  localStorage.removeItem("wb2_session");
}

// ============================================================
// SMALL UI COMPONENTS
// ============================================================
function LoadingSpinner({ message = "Loading..." }) {
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", height:"100vh", gap:16 }}>
      <div style={{ width:48, height:48, border:"4px solid #e2e8f0", borderTop:"4px solid #667eea", borderRadius:"50%", animation:"spin 1s linear infinite" }} />
      <p style={{ color:"#64748b", fontSize:14 }}>{message}</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function MemberBadge({ name, size = "sm", showName = true }) {
  const color = MEMBER_COLORS[name] || "#94a3b8";
  const sizes = { xs: { w:20, h:20, f:9 }, sm: { w:28, h:28, f:11 }, md: { w:36, h:36, f:14 }, lg: { w:48, h:48, f:18 } };
  const s = sizes[size] || sizes.sm;
  return (
    <div style={{ display:"flex", alignItems:"center", gap:6 }}>
      <div style={{ width:s.w, height:s.h, borderRadius:"50%", background:color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:s.f, fontWeight:700, color:"white", flexShrink:0 }}>
        {name[0]}
      </div>
      {showName && <span style={{ fontSize:s.f+1, color:"#374151" }}>{name}</span>}
    </div>
  );
}

// ============================================================
// TRIP LOGIN
// ============================================================
function TripLogin({ trip, onJoin, onBack }) {
  const [step, setStep] = React.useState("member");
  const [selectedMember, setSelectedMember] = React.useState(null);
  const [remember, setRemember] = React.useState(false);
  const [avatarChoice, setAvatarChoice] = React.useState(null);
  const [loadingMember, setLoadingMember] = React.useState(null);

  async function chooseMember(m) {
    setLoadingMember(m);
    const av = await loadAvatarChoice(trip.id, m);
    setSelectedMember(m);
    setAvatarChoice(av);
    setLoadingMember(null);
    setStep("avatar");
  }

  async function handleJoin() {
    if (remember) saveSession(trip.id, selectedMember);
    onJoin(selectedMember);
  }

  if (step === "member") return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"white", borderRadius:24, padding:40, maxWidth:400, width:"100%", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:48, marginBottom:16 }}>✈️</div>
        <h1 style={{ fontSize:24, fontWeight:700, color:"#1e293b", marginBottom:8 }}>{trip.name}</h1>
        <p style={{ color:"#64748b", marginBottom:32 }}>Who's joining this trip?</p>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:24 }}>
          {MEMBERS.map(m => (
            <button key={m} onClick={() => chooseMember(m)} disabled={!!loadingMember}
              style={{ padding:"16px 12px", borderRadius:16, border:"2px solid #e2e8f0", background:loadingMember===m?"#f1f5f9":"white", cursor:"pointer", transition:"all 0.2s", display:"flex", flexDirection:"column", alignItems:"center", gap:8 }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:MEMBER_COLORS[m], display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"white" }}>
                {loadingMember===m ? "⌛" : m[0]}
              </div>
              <span style={{ fontSize:14, fontWeight:600, color:"#374151" }}>{m}</span>
            </button>
          ))}
        </div>
        <button onClick={onBack} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:14 }}>← Back to trips</button>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ background:"white", borderRadius:24, padding:40, maxWidth:400, width:"100%", textAlign:"center", boxShadow:"0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ fontSize:48, marginBottom:8 }}>{avatarChoice || m => m[0]}</div>
        <h2 style={{ fontSize:20, fontWeight:700, color:"#1e293b", marginBottom:4 }}>Hi, {selectedMember}!</h2>
        <p style={{ color:"#64748b", marginBottom:24, fontSize:14 }}>Ready to plan {trip.name}?</p>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:24 }}>
          {AVATAR_OPTIONS.map(a => (
            <button key={a} onClick={() => { setAvatarChoice(a); saveAvatarChoice(trip.id, selectedMember, a); }}
              style={{ padding:8, borderRadius:12, border:`2px solid ${avatarChoice===a?"#667eea":"#e2e8f0"}`, background:avatarChoice===a?"#f0f4ff":"white", cursor:"pointer", fontSize:22 }}>
              {a}
            </button>
          ))}
        </div>
        <label style={{ display:"flex", alignItems:"center", gap:8, justifyContent:"center", marginBottom:24, cursor:"pointer", fontSize:14, color:"#64748b" }}>
          <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} />
          Remember me on this device
        </label>
        <button onClick={handleJoin}
          style={{ width:"100%", padding:"14px", borderRadius:14, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", fontSize:16, fontWeight:600, cursor:"pointer" }}>
          Enter Trip ✈️
        </button>
        <button onClick={() => setStep("member")} style={{ background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:14, marginTop:12 }}>← Change member</button>
      </div>
    </div>
  );
}

// ============================================================
// PRINT ITINERARY
// ============================================================
function PrintItinerary({ trip }) {
  const itinerary = trip._itinerary || {};
  const dayTitles = trip._dayTitles || {};
  if (!trip.startDate || !trip.endDate) return <div style={{padding:40,textAlign:"center",color:"#64748b"}}>No dates set for this trip.</div>;
  const days = [];
  let cur = new Date(trip.startDate + "T00:00:00");
  const end = new Date(trip.endDate + "T00:00:00");
  let idx = 0;
  while (cur <= end) {
    days.push({ date: cur.toISOString().split("T")[0], index: idx });
    cur.setDate(cur.getDate() + 1);
    idx++;
  }
  return (
    <div style={{ fontFamily:"Georgia,serif", maxWidth:800, margin:"0 auto", padding:40 }}>
      <div style={{ textAlign:"center", marginBottom:40, borderBottom:"3px solid #667eea", paddingBottom:24 }}>
        <h1 style={{ fontSize:32, color:"#1e293b", margin:0 }}>{trip.name}</h1>
        <p style={{ color:"#64748b", marginTop:8 }}>{trip.startDate} → {trip.endDate} · {trip.destination}</p>
      </div>
      {days.map(({ date, index }) => {
        const events = (itinerary[date] || []).sort((a,b) => (a.time||"").localeCompare(b.time||""));
        if (!events.length) return null;
        return (
          <div key={date} style={{ marginBottom:32 }}>
            <h2 style={{ fontSize:18, color:"#667eea", borderBottom:"1px solid #e2e8f0", paddingBottom:8 }}>
              Day {index+1} — {date}{dayTitles[date] ? ` · ${dayTitles[date]}` : ""}
            </h2>
            {events.map(ev => (
              <div key={ev.id} style={{ marginBottom:12, paddingLeft:16, borderLeft:"3px solid #e2e8f0" }}>
                <div style={{ fontWeight:600 }}>{ev.time && <span style={{color:"#667eea",marginRight:8}}>{ev.time}</span>}{ev.title}</div>
                {ev.location && <div style={{ fontSize:13, color:"#64748b" }}>📍 {ev.location}</div>}
                {ev.notes && <div style={{ fontSize:13, color:"#374151", marginTop:4 }}>{ev.notes}</div>}
                {ev.cost && <div style={{ fontSize:13, color:"#10b981" }}>💰 {ev.cost}</div>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}// ============================================================
// TRIP CANVAS (main trip view)
// ============================================================
function TripCanvas({ trip, member, onBack, onUpdateTrip }) {
  const [activeTab, setActiveTab] = React.useState("itinerary");
  const [itinerary, setItinerary] = React.useState({});
  const [dayTitles, setDayTitles] = React.useState({});
  const [checklist, setChecklist] = React.useState([]);
  const [docs, setDocs] = React.useState([]);
  const [printing, setPrinting] = React.useState(false);
  const [editingTrip, setEditingTrip] = React.useState(false);
  const itineraryLoaded = React.useRef(false);

  // Load all data on mount
  React.useEffect(() => {
    async function loadAll() {
      // Load itinerary
      const rows = await sbGet("trip_itineraries", `trip_id=eq.${trip.id}`);
      if (rows && rows.length > 0) {
        const itin = {};
        const titles = {};
        rows.forEach(r => {
          itin[r.date] = r.events || [];
          if (r.day_title) titles[r.date] = r.day_title;
        });
        setItinerary(itin);
        setDayTitles(titles);
      }
      itineraryLoaded.current = true;

      // Load checklist
      const chkRows = await sbGet("trip_checklists", `trip_id=eq.${trip.id}`);
      if (chkRows && chkRows.length > 0) {
        setChecklist(chkRows);
      } else {
        setChecklist(DEFAULT_CHECKLIST.map(i => ({ ...i, trip_id: trip.id })));
      }

      // Load docs
      const docRows = await sbGet("trip_docs", `trip_id=eq.${trip.id}`);
      if (docRows) setDocs(docRows);
    }
    loadAll();
  }, [trip.id]);

  // Save itinerary whenever it changes (after initial load)
  React.useEffect(() => {
    if (!itineraryLoaded.current) return;
    async function save() {
      const rows = Object.keys(itinerary).map(date => ({
        trip_id: trip.id,
        date,
        events: itinerary[date] || [],
        day_title: dayTitles[date] || null,
      }));
      if (rows.length > 0) await sbUpsert("trip_itineraries", rows);
    }
    save();
  }, [itinerary, dayTitles]);

  // --- Itinerary helpers ---
  function getDays() {
    if (!trip.startDate || !trip.endDate) return [];
    const days = [];
    let cur = new Date(trip.startDate + "T00:00:00");
    const end = new Date(trip.endDate + "T00:00:00");
    while (cur <= end) {
      days.push(cur.toISOString().split("T")[0]);
      cur.setDate(cur.getDate() + 1);
    }
    return days;
  }

  function addEvent(date, ev) {
    setItinerary(prev => ({ ...prev, [date]: [...(prev[date] || []), { ...ev, id: Date.now().toString(), addedBy: member }] }));
  }

  function updateEvent(date, id, changes) {
    setItinerary(prev => ({ ...prev, [date]: (prev[date] || []).map(e => e.id === id ? { ...e, ...changes } : e) }));
  }

  function deleteEvent(date, id) {
    setItinerary(prev => ({ ...prev, [date]: (prev[date] || []).filter(e => e.id !== id) }));
  }

  // --- Checklist helpers ---
  async function addCheckItem(text, category) {
    const item = { id: Date.now().toString(), trip_id: trip.id, text, checked_by: [], category };
    await sbUpsert("trip_checklists", [item]);
    setChecklist(prev => [...prev, item]);
  }

  async function toggleCheck(id) {
    const item = checklist.find(i => i.id === id);
    if (!item) return;
    const already = (item.checked_by || []).includes(member);
    const updated = { ...item, checked_by: already ? item.checked_by.filter(m => m !== member) : [...(item.checked_by || []), member] };
    await sbUpsert("trip_checklists", [updated]);
    setChecklist(prev => prev.map(i => i.id === id ? updated : i));
  }

  async function deleteCheckItem(id) {
    await sbDelete("trip_checklists", `id=eq.${id}`);
    setChecklist(prev => prev.filter(i => i.id !== id));
  }

  // --- Docs helpers ---
  async function uploadDoc(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const doc = { id: Date.now().toString(), trip_id: trip.id, name: file.name, type: file.type, size: file.size, data: e.target.result, uploadedBy: member, uploadedAt: new Date().toISOString() };
      await sbUpsert("trip_docs", [doc]);
      setDocs(prev => [...prev, doc]);
    };
    reader.readAsDataURL(file);
  }

  async function deleteDoc(id) {
    await sbDelete("trip_docs", `id=eq.${id}`);
    setDocs(prev => prev.filter(d => d.id !== id));
  }

  // --- Print ---
  function handlePrint() {
    const printTrip = { ...trip, _itinerary: itinerary, _dayTitles: dayTitles };
    const orig = document.title;
    document.title = trip.name;
    setPrinting(true);
    setTimeout(() => { window.print(); setPrinting(false); document.title = orig; }, 300);
  }

  if (printing) return <PrintItinerary trip={{ ...trip, _itinerary: itinerary, _dayTitles: dayTitles }} />;

  const days = getDays();
  const totalChecked = checklist.filter(i => (i.checked_by || []).length > 0).length;

  // Tab styles
  const tabStyle = (t) => ({
    padding: "10px 20px", border: "none", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600,
    background: activeTab === t ? "linear-gradient(135deg,#667eea,#764ba2)" : "transparent",
    color: activeTab === t ? "white" : "#64748b", transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#667eea 0%,#764ba2 100%)", padding: "20px 24px", color: "white" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <button onClick={onBack} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>← Trips</button>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setEditingTrip(true)} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>✏️ Edit</button>
              <button onClick={handlePrint} style={{ background: "rgba(255,255,255,0.2)", border: "none", color: "white", padding: "8px 16px", borderRadius: 10, cursor: "pointer", fontSize: 14 }}>🖨️ Print</button>
            </div>
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>{trip.name}</h1>
          <p style={{ opacity: 0.85, marginTop: 4, fontSize: 14 }}>📍 {trip.destination} · {trip.startDate} → {trip.endDate}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
            <MemberBadge name={member} size="sm" />
            <span style={{ opacity: 0.75, fontSize: 13 }}>viewing as {member}</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ background: "white", borderBottom: "1px solid #e2e8f0", padding: "0 24px" }}>
        <div style={{ maxWidth: 900, margin: "0 auto", display: "flex", gap: 4, padding: "8px 0" }}>
          {[["itinerary","📅 Itinerary"],["checklist",`✅ Checklist (${totalChecked}/${checklist.length})`],["docs","📎 Docs"]].map(([t,label]) => (
            <button key={t} onClick={() => setActiveTab(t)} style={tabStyle(t)}>{label}</button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>

        {/* ITINERARY TAB */}
        {activeTab === "itinerary" && (
          <ItineraryTab days={days} itinerary={itinerary} dayTitles={dayTitles} member={member}
            onAddEvent={addEvent} onUpdateEvent={updateEvent} onDeleteEvent={deleteEvent}
            onSetDayTitle={(date, title) => setDayTitles(prev => ({ ...prev, [date]: title }))} />
        )}

        {/* CHECKLIST TAB */}
        {activeTab === "checklist" && (
          <ChecklistTab checklist={checklist} member={member}
            onAdd={addCheckItem} onToggle={toggleCheck} onDelete={deleteCheckItem} />
        )}

        {/* DOCS TAB */}
        {activeTab === "docs" && (
          <DocsTab docs={docs} member={member} onUpload={uploadDoc} onDelete={deleteDoc} />
        )}
      </div>

      {/* Edit Trip Modal */}
      {editingTrip && (
        <EditTripModal trip={trip} onSave={(updated) => { onUpdateTrip(updated); setEditingTrip(false); }} onClose={() => setEditingTrip(false)} />
      )}
    </div>
  );
}

// ============================================================
// ITINERARY TAB
// ============================================================
function ItineraryTab({ days, itinerary, dayTitles, member, onAddEvent, onUpdateEvent, onDeleteEvent, onSetDayTitle }) {
  const [addingTo, setAddingTo] = React.useState(null);
  const [editingEvent, setEditingEvent] = React.useState(null);
  const [newEv, setNewEv] = React.useState({ title:"", time:"", location:"", notes:"", cost:"", category:"activity" });
  const CATEGORIES = ["activity","food","transport","accommodation","other"];
  const CAT_COLORS = { activity:"#667eea", food:"#f59e0b", transport:"#10b981", accommodation:"#8b5cf6", other:"#94a3b8" };

  function submitAdd(date) {
    if (!newEv.title.trim()) return;
    onAddEvent(date, newEv);
    setNewEv({ title:"", time:"", location:"", notes:"", cost:"", category:"activity" });
    setAddingTo(null);
  }

  if (!days.length) return (
    <div style={{ textAlign:"center", padding:60, color:"#64748b" }}>
      <div style={{ fontSize:48, marginBottom:16 }}>📅</div>
      <p>No dates set for this trip yet. Edit the trip to add dates!</p>
    </div>
  );

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
      {days.map((date, idx) => {
        const events = (itinerary[date] || []).slice().sort((a,b) => (a.time||"").localeCompare(b.time||""));
        return (
          <div key={date} style={{ background:"white", borderRadius:16, overflow:"hidden", boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ background:"linear-gradient(135deg,#667eea,#764ba2)", padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <span style={{ color:"white", fontWeight:700, fontSize:16 }}>Day {idx+1} — {date}</span>
                {dayTitles[date] && <span style={{ color:"rgba(255,255,255,0.8)", fontSize:13, marginLeft:8 }}>· {dayTitles[date]}</span>}
              </div>
              <button onClick={() => { const t = prompt("Day title:", dayTitles[date]||""); if (t !== null) onSetDayTitle(date, t); }}
                style={{ background:"rgba(255,255,255,0.2)", border:"none", color:"white", padding:"4px 10px", borderRadius:8, cursor:"pointer", fontSize:12 }}>+ Title</button>
            </div>
            <div style={{ padding:16 }}>
              {events.length === 0 && <p style={{ color:"#94a3b8", fontSize:13, textAlign:"center", margin:"8px 0" }}>No events yet</p>}
              {events.map(ev => (
                <div key={ev.id} style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"10px 0", borderBottom:"1px solid #f1f5f9" }}>
                  <div style={{ width:10, height:10, borderRadius:"50%", background:CAT_COLORS[ev.category]||"#94a3b8", marginTop:5, flexShrink:0 }} />
                  <div style={{ flex:1 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                      {ev.time && <span style={{ fontSize:12, color:"#667eea", fontWeight:600 }}>{ev.time}</span>}
                      <span style={{ fontWeight:600, color:"#1e293b" }}>{ev.title}</span>
                      <span style={{ fontSize:11, color:"#94a3b8" }}>by {ev.addedBy}</span>
                    </div>
                    {ev.location && <div style={{ fontSize:12, color:"#64748b", marginTop:2 }}>📍 {ev.location}</div>}
                    {ev.notes && <div style={{ fontSize:12, color:"#374151", marginTop:2 }}>{ev.notes}</div>}
                    {ev.cost && <div style={{ fontSize:12, color:"#10b981", marginTop:2 }}>💰 {ev.cost}</div>}
                  </div>
                  <button onClick={() => setEditingEvent({ date, ev: { ...ev } })} style={{ background:"none", border:"none", cursor:"pointer", color:"#94a3b8", fontSize:16 }}>✏️</button>
                  <button onClick={() => onDeleteEvent(date, ev.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#fca5a5", fontSize:16 }}>🗑️</button>
                </div>
              ))}
              {addingTo === date ? (
                <div style={{ marginTop:12, padding:16, background:"#f8fafc", borderRadius:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:8 }}>
                    <input placeholder="Event title *" value={newEv.title} onChange={e=>setNewEv(p=>({...p,title:e.target.value}))}
                      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, gridColumn:"1/-1" }} />
                    <input placeholder="Time (e.g. 09:00)" value={newEv.time} onChange={e=>setNewEv(p=>({...p,time:e.target.value}))}
                      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }} />
                    <select value={newEv.category} onChange={e=>setNewEv(p=>({...p,category:e.target.value}))}
                      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }}>
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <input placeholder="Location" value={newEv.location} onChange={e=>setNewEv(p=>({...p,location:e.target.value}))}
                      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }} />
                    <input placeholder="Cost" value={newEv.cost} onChange={e=>setNewEv(p=>({...p,cost:e.target.value}))}
                      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14 }} />
                    <input placeholder="Notes" value={newEv.notes} onChange={e=>setNewEv(p=>({...p,notes:e.target.value}))}
                      style={{ padding:"8px 12px", borderRadius:8, border:"1px solid #e2e8f0", fontSize:14, gridColumn:"1/-1" }} />
                  </div>
                  <div style={{ display:"flex", gap:8 }}>
                    <button onClick={() => submitAdd(date)} style={{ flex:1, padding:"8px", borderRadius:8, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600 }}>Add Event</button>
                    <button onClick={() => setAddingTo(null)} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setAddingTo(date)} style={{ marginTop:12, width:"100%", padding:"8px", borderRadius:10, border:"2px dashed #e2e8f0", background:"none", color:"#94a3b8", cursor:"pointer", fontSize:14 }}>+ Add Event</button>
              )}
            </div>
          </div>
        );
      })}

      {/* Edit Event Modal */}
      {editingEvent && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
          <div style={{ background:"white", borderRadius:20, padding:28, maxWidth:440, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin:"0 0 20px", color:"#1e293b" }}>Edit Event</h3>
            {["title","time","location","cost","notes"].map(field => (
              <input key={field} placeholder={field.charAt(0).toUpperCase()+field.slice(1)} value={editingEvent.ev[field]||""}
                onChange={e => setEditingEvent(p => ({ ...p, ev: { ...p.ev, [field]: e.target.value } }))}
                style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1px solid #e2e8f0", fontSize:14, marginBottom:10, boxSizing:"border-box" }} />
            ))}
            <div style={{ display:"flex", gap:8, marginTop:8 }}>
              <button onClick={() => { onUpdateEvent(editingEvent.date, editingEvent.ev.id, editingEvent.ev); setEditingEvent(null); }}
                style={{ flex:1, padding:"10px", borderRadius:10, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600 }}>Save</button>
              <button onClick={() => setEditingEvent(null)} style={{ padding:"10px 20px", borderRadius:10, border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// CHECKLIST TAB
// ============================================================
function ChecklistTab({ checklist, member, onAdd, onToggle, onDelete }) {
  const [newText, setNewText] = React.useState("");
  const [newCat, setNewCat] = React.useState("travel");
  const categories = ["travel","documents","packing","other"];
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = checklist.filter(i => i.category === cat);
    return acc;
  }, {});

  return (
    <div>
      <div style={{ background:"white", borderRadius:16, padding:20, marginBottom:20, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ display:"flex", gap:8 }}>
          <input placeholder="Add checklist item..." value={newText} onChange={e => setNewText(e.target.value)}
            onKeyDown={e => { if (e.key==="Enter" && newText.trim()) { onAdd(newText.trim(), newCat); setNewText(""); }}}
            style={{ flex:1, padding:"10px 14px", borderRadius:10, border:"1px solid #e2e8f0", fontSize:14 }} />
          <select value={newCat} onChange={e => setNewCat(e.target.value)}
            style={{ padding:"10px 12px", borderRadius:10, border:"1px solid #e2e8f0", fontSize:14 }}>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <button onClick={() => { if (newText.trim()) { onAdd(newText.trim(), newCat); setNewText(""); }}}
            style={{ padding:"10px 18px", borderRadius:10, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600 }}>Add</button>
        </div>
      </div>
      {categories.map(cat => grouped[cat].length > 0 && (
        <div key={cat} style={{ background:"white", borderRadius:16, padding:20, marginBottom:16, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <h3 style={{ margin:"0 0 12px", fontSize:14, fontWeight:700, color:"#64748b", textTransform:"uppercase", letterSpacing:1 }}>{cat}</h3>
          {grouped[cat].map(item => {
            const checked = (item.checked_by || []).includes(member);
            return (
              <div key={item.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 0", borderBottom:"1px solid #f1f5f9" }}>
                <button onClick={() => onToggle(item.id)} style={{ width:22, height:22, borderRadius:6, border:`2px solid ${checked?"#667eea":"#d1d5db"}`, background:checked?"#667eea":"white", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  {checked && <span style={{ color:"white", fontSize:14 }}>✓</span>}
                </button>
                <span style={{ flex:1, fontSize:14, color:"#1e293b", textDecoration:checked?"line-through":"none", opacity:checked?0.6:1 }}>{item.text}</span>
                {(item.checked_by||[]).length > 0 && (
                  <div style={{ display:"flex", gap:4 }}>
                    {item.checked_by.map(m => <MemberBadge key={m} name={m} size="xs" showName={false} />)}
                  </div>
                )}
                <button onClick={() => onDelete(item.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#fca5a5", fontSize:14 }}>✕</button>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// DOCS TAB
// ============================================================
function DocsTab({ docs, member, onUpload, onDelete }) {
  const fileRef = React.useRef();
  return (
    <div>
      <div style={{ background:"white", borderRadius:16, padding:20, marginBottom:20, textAlign:"center", border:"2px dashed #e2e8f0", cursor:"pointer" }} onClick={() => fileRef.current.click()}>
        <div style={{ fontSize:32, marginBottom:8 }}>📎</div>
        <p style={{ color:"#64748b", margin:0 }}>Click to upload documents</p>
        <input ref={fileRef} type="file" style={{ display:"none" }} onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0]); e.target.value=""; }} />
      </div>
      {docs.length === 0 && <p style={{ textAlign:"center", color:"#94a3b8" }}>No documents yet</p>}
      {docs.map(doc => (
        <div key={doc.id} style={{ background:"white", borderRadius:12, padding:"14px 20px", marginBottom:10, display:"flex", alignItems:"center", gap:12, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
          <span style={{ fontSize:24 }}>{doc.type?.includes("pdf")?"📄":doc.type?.includes("image")?"🖼️":"📁"}</span>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:600, color:"#1e293b", fontSize:14 }}>{doc.name}</div>
            <div style={{ fontSize:12, color:"#94a3b8" }}>Uploaded by {doc.uploadedBy}</div>
          </div>
          <a href={doc.data} download={doc.name} style={{ padding:"6px 14px", borderRadius:8, background:"#f1f5f9", color:"#374151", textDecoration:"none", fontSize:13 }}>Download</a>
          <button onClick={() => onDelete(doc.id)} style={{ background:"none", border:"none", cursor:"pointer", color:"#fca5a5", fontSize:18 }}>🗑️</button>
        </div>
      ))}
    </div>
  );
}

// ============================================================
// EDIT TRIP MODAL
// ============================================================
function EditTripModal({ trip, onSave, onClose }) {
  const [form, setForm] = React.useState({ name: trip.name||"", destination: trip.destination||"", startDate: trip.startDate||"", endDate: trip.endDate||"", description: trip.description||"" });
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.5)", display:"flex", alignItems:"center", justifyContent:"center", zIndex:1000, padding:20 }}>
      <div style={{ background:"white", borderRadius:20, padding:32, maxWidth:460, width:"100%", boxShadow:"0 20px 60px rgba(0,0,0,0.3)" }}>
        <h2 style={{ margin:"0 0 24px", color:"#1e293b" }}>Edit Trip</h2>
        {[["name","Trip Name"],["destination","Destination"],["startDate","Start Date"],["endDate","End Date"],["description","Description"]].map(([field, label]) => (
          <div key={field} style={{ marginBottom:14 }}>
            <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#64748b", marginBottom:4 }}>{label}</label>
            <input type={field.includes("Date")?"date":"text"} value={form[field]} onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
              style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1px solid #e2e8f0", fontSize:14, boxSizing:"border-box" }} />
          </div>
        ))}
        <div style={{ display:"flex", gap:10, marginTop:8 }}>
          <button onClick={() => onSave({ ...trip, ...form })} style={{ flex:1, padding:"12px", borderRadius:12, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600, fontSize:15 }}>Save Changes</button>
          <button onClick={onClose} style={{ padding:"12px 20px", borderRadius:12, border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>Cancel</button>
        </div>
      </div>
    </div>
  );
}// ============================================================
// TRIP CARD
// ============================================================
function TripCard({ trip, onOpen, onDelete }) {
  const daysUntil = trip.startDate ? Math.ceil((new Date(trip.startDate + "T00:00:00") - new Date()) / (1000*60*60*24)) : null;
  return (
    <div style={{ background:"white", borderRadius:20, overflow:"hidden", boxShadow:"0 2px 12px rgba(0,0,0,0.08)", transition:"transform 0.2s", cursor:"pointer" }} onClick={() => onOpen(trip)}>
      <div style={{ background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)", padding:"24px 24px 20px", position:"relative" }}>
        <div style={{ fontSize:36, marginBottom:8 }}>✈️</div>
        <h3 style={{ color:"white", fontSize:20, fontWeight:800, margin:0 }}>{trip.name}</h3>
        <p style={{ color:"rgba(255,255,255,0.8)", fontSize:14, margin:"4px 0 0" }}>📍 {trip.destination}</p>
        <button onClick={e => { e.stopPropagation(); if (window.confirm("Delete this trip?")) onDelete(trip.id); }}
          style={{ position:"absolute", top:16, right:16, background:"rgba(255,255,255,0.2)", border:"none", color:"white", width:30, height:30, borderRadius:"50%", cursor:"pointer", fontSize:14 }}>✕</button>
      </div>
      <div style={{ padding:"16px 24px 20px" }}>
        {trip.startDate && <p style={{ fontSize:13, color:"#64748b", margin:"0 0 8px" }}>📅 {trip.startDate} → {trip.endDate}</p>}
        {daysUntil !== null && (
          <div style={{ display:"inline-block", padding:"4px 12px", borderRadius:20, background: daysUntil < 0 ? "#f1f5f9" : daysUntil < 30 ? "#fef3c7" : "#f0fdf4", color: daysUntil < 0 ? "#94a3b8" : daysUntil < 30 ? "#d97706" : "#16a34a", fontSize:12, fontWeight:600 }}>
            {daysUntil < 0 ? "Trip completed" : daysUntil === 0 ? "Today! 🎉" : `${daysUntil} days to go`}
          </div>
        )}
        {trip.description && <p style={{ fontSize:13, color:"#64748b", marginTop:10, marginBottom:0 }}>{trip.description}</p>}
      </div>
    </div>
  );
}

// ============================================================
// ROOT APP
// ============================================================
export default function App() {
  const [trips, setTrips] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [view, setView] = React.useState("home"); // "home" | "login" | "canvas"
  const [selectedTrip, setSelectedTrip] = React.useState(null);
  const [currentMember, setCurrentMember] = React.useState(null);
  const [showNewTrip, setShowNewTrip] = React.useState(false);
  const [newTripForm, setNewTripForm] = React.useState({ name:"", destination:"", startDate:"", endDate:"", description:"" });

  // Load trips from Supabase on mount
  React.useEffect(() => {
    async function init() {
      const rows = await sbGet("trips");
      if (rows) setTrips(rows);
      setLoading(false);

      // Check for saved session
      const session = loadSession();
      if (session && rows) {
        const trip = rows.find(t => t.id === session.tripId);
        if (trip) {
          setSelectedTrip(trip);
          setCurrentMember(session.member);
          setView("canvas");
        }
      }
    }
    init();
  }, []);

  async function handleNewTrip() {
    if (!newTripForm.name.trim()) return;
    const trip = { id: Date.now().toString(), ...newTripForm, createdAt: new Date().toISOString() };
    await sbUpsert("trips", [trip]);
    setTrips(prev => [...prev, trip]);
    setNewTripForm({ name:"", destination:"", startDate:"", endDate:"", description:"" });
    setShowNewTrip(false);
  }

  async function handleUpdateTrip(updated) {
    await sbUpsert("trips", [updated]);
    setTrips(prev => prev.map(t => t.id === updated.id ? updated : t));
    setSelectedTrip(updated);
  }

  async function handleDeleteTrip(id) {
    await sbDelete("trips", `id=eq.${id}`);
    setTrips(prev => prev.filter(t => t.id !== id));
  }

  function openTrip(trip) {
    setSelectedTrip(trip);
    setView("login");
  }

  function handleJoin(member) {
    setCurrentMember(member);
    setView("canvas");
  }

  function handleBack() {
    clearSession();
    setView("home");
    setSelectedTrip(null);
    setCurrentMember(null);
  }

  if (loading) return <LoadingSpinner message="Loading your trips..." />;

  if (view === "login" && selectedTrip) {
    return <TripLogin trip={selectedTrip} onJoin={handleJoin} onBack={() => setView("home")} />;
  }

  if (view === "canvas" && selectedTrip && currentMember) {
    return <TripCanvas trip={selectedTrip} member={currentMember} onBack={handleBack} onUpdateTrip={handleUpdateTrip} />;
  }

  // HOME
  return (
    <div style={{ minHeight:"100vh", background:"linear-gradient(135deg,#667eea 0%,#764ba2 100%)" }}>
      {/* Hero */}
      <div style={{ padding:"48px 24px 32px", textAlign:"center", color:"white" }}>
        <div style={{ fontSize:56, marginBottom:12 }}>🗺️</div>
        <h1 style={{ fontSize:36, fontWeight:900, margin:0, letterSpacing:-1 }}>WanderBoard</h1>
        <p style={{ opacity:0.85, marginTop:8, fontSize:16 }}>Plan trips together, from anywhere</p>
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:8 }}>
          {MEMBERS.map(m => <MemberBadge key={m} name={m} size="sm" showName={false} />)}
        </div>
      </div>

      <div style={{ background:"#f8fafc", borderRadius:"24px 24px 0 0", minHeight:"60vh", padding:24 }}>
        <div style={{ maxWidth:800, margin:"0 auto" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
            <h2 style={{ fontSize:20, fontWeight:700, color:"#1e293b", margin:0 }}>Your Trips</h2>
            <button onClick={() => setShowNewTrip(true)}
              style={{ padding:"10px 20px", borderRadius:12, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600, fontSize:14 }}>
              + New Trip
            </button>
          </div>

          {trips.length === 0 && !showNewTrip && (
            <div style={{ textAlign:"center", padding:"60px 20px", color:"#94a3b8" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>✈️</div>
              <p style={{ fontSize:16, marginBottom:20 }}>No trips yet! Create your first one.</p>
              <button onClick={() => setShowNewTrip(true)}
                style={{ padding:"12px 28px", borderRadius:14, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600, fontSize:15 }}>
                Plan a Trip
              </button>
            </div>
          )}

          {showNewTrip && (
            <div style={{ background:"white", borderRadius:20, padding:28, marginBottom:24, boxShadow:"0 4px 20px rgba(0,0,0,0.1)" }}>
              <h3 style={{ margin:"0 0 20px", color:"#1e293b" }}>New Trip</h3>
              {[["name","Trip Name *"],["destination","Destination"],["startDate","Start Date"],["endDate","End Date"],["description","Description"]].map(([field, label]) => (
                <div key={field} style={{ marginBottom:12 }}>
                  <label style={{ display:"block", fontSize:13, fontWeight:600, color:"#64748b", marginBottom:4 }}>{label}</label>
                  <input type={field.includes("Date")?"date":"text"} placeholder={label} value={newTripForm[field]}
                    onChange={e => setNewTripForm(p => ({ ...p, [field]: e.target.value }))}
                    style={{ width:"100%", padding:"10px 14px", borderRadius:10, border:"1px solid #e2e8f0", fontSize:14, boxSizing:"border-box" }} />
                </div>
              ))}
              <div style={{ display:"flex", gap:10, marginTop:8 }}>
                <button onClick={handleNewTrip} style={{ flex:1, padding:"12px", borderRadius:12, background:"linear-gradient(135deg,#667eea,#764ba2)", color:"white", border:"none", cursor:"pointer", fontWeight:600, fontSize:15 }}>Create Trip</button>
                <button onClick={() => setShowNewTrip(false)} style={{ padding:"12px 20px", borderRadius:12, border:"1px solid #e2e8f0", background:"white", cursor:"pointer" }}>Cancel</button>
              </div>
            </div>
          )}

          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:16 }}>
            {trips.map(trip => (
              <TripCard key={trip.id} trip={trip} onOpen={openTrip} onDelete={handleDeleteTrip} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
