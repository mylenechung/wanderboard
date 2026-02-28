// src/db.js
// ─────────────────────────────────────────────────────────────
// All Supabase data operations for Wanderboard.
// Import these functions in trip-planner.jsx and call them
// instead of the localStorage helpers that were there before.
// ─────────────────────────────────────────────────────────────
import { supabase } from "./supabaseClient";

// ─── Helpers ─────────────────────────────────────────────────
function uid() {
  return Math.random().toString(36).slice(2, 9);
}

// ─── TRIPS ───────────────────────────────────────────────────

/** Load all trips (list view). Members + location counts included. */
export async function fetchAllTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select(`
      *,
      members(*),
      locations(id)
    `)
    .order("created_at", { ascending: false });

  if (error) throw error;

  // Reshape to the shape the app already expects
  return data.map((t) => ({
    id:         t.id,
    name:       t.name,
    location:   t.location,
    startDate:  t.start_date,
    endDate:    t.end_date,
    numDays:    t.num_days,
    password:   t.password,
    createdAt:  new Date(t.created_at).getTime(),
    members:    t.members.map(normaliseMember),
    locations:  [], // loaded lazily when a trip is opened
    _locationCount: t.locations.length,
  }));
}

/** Load a single trip with all its data (for the canvas). */
export async function fetchTrip(tripId) {
  const [tripRes, locRes] = await Promise.all([
    supabase
      .from("trips")
      .select("*, members(*)")
      .eq("id", tripId)
      .single(),
    supabase
      .from("locations")
      .select("*")
      .eq("trip_id", tripId)
      .order("created_at", { ascending: true }),
  ]);

  if (tripRes.error) throw tripRes.error;
  if (locRes.error)  throw locRes.error;

  const t = tripRes.data;
  return {
    id:        t.id,
    name:      t.name,
    location:  t.location,
    startDate: t.start_date,
    endDate:   t.end_date,
    numDays:   t.num_days,
    password:  t.password,
    createdAt: new Date(t.created_at).getTime(),
    members:   t.members.map(normaliseMember),
    locations: locRes.data.map(normaliseLocation),
  };
}

/** Create a brand-new trip with its initial members. */
export async function createTrip({ id, name, location, startDate, endDate, numDays, password, members }) {
  const tripId = id || uid();

  const { error: tripErr } = await supabase.from("trips").insert({
    id:         tripId,
    name,
    location,
    start_date: startDate || null,
    end_date:   endDate   || null,
    num_days:   numDays   || 1,
    password,
  });
  if (tripErr) throw tripErr;

  if (members?.length) {
    const { error: memErr } = await supabase.from("members").insert(
      members.map((m) => ({
        id:      m.id || uid(),
        trip_id: tripId,
        name:    m.name,
        avatar:  m.avatar || null,
      }))
    );
    if (memErr) throw memErr;
  }

  return fetchTrip(tripId);
}

/** Delete a trip (cascades to all related rows via FK). */
export async function deleteTrip(tripId) {
  const { error } = await supabase.from("trips").delete().eq("id", tripId);
  if (error) throw error;
}

/** Update trip details (name, location, dates, password). */
export async function updateTrip(tripId, fields) {
  const { data, error } = await supabase
    .from("trips")
    .update({
      name:       fields.name,
      location:   fields.location,
      start_date: fields.startDate || null,
      end_date:   fields.endDate   || null,
      num_days:   fields.numDays   || 1,
      password:   fields.password,
    })
    .eq("id", tripId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── MEMBERS ─────────────────────────────────────────────────

/** Add a member to an existing trip. */
export async function addMember(tripId, name) {
  const id = uid();
  const { error } = await supabase.from("members").insert({
    id,
    trip_id: tripId,
    name,
    avatar:  null,
  });
  if (error) throw error;
  return { id, name, avatar: null };
}

/** Remove a member from a trip. */
export async function removeMember(memberId) {
  const { error } = await supabase.from("members").delete().eq("id", memberId);
  if (error) throw error;
}

/** Persist a member's chosen avatar. */
export async function saveMemberAvatar(memberId, avatar) {
  const { error } = await supabase
    .from("members")
    .update({ avatar })
    .eq("id", memberId);
  if (error) throw error;
}

// ─── LOCATIONS ───────────────────────────────────────────────

/** Add a new place to a trip. */
export async function addLocation(tripId, form, addedBy) {
  const id = uid();
  const { data, error } = await supabase
    .from("locations")
    .insert({
      id,
      trip_id:  tripId,
      name:     form.name,
      map_link: form.mapLink  || null,
      area:     form.area     || null,
      notes:    form.notes    || null,
      icon:     form.icon     || "pin",
      added_by: addedBy,
      votes:    [],
    })
    .select()
    .single();
  if (error) throw error;
  return normaliseLocation(data);
}

/** Update an existing place. */
export async function updateLocation(locationId, form) {
  const { data, error } = await supabase
    .from("locations")
    .update({
      name:     form.name,
      map_link: form.mapLink  || null,
      area:     form.area     || null,
      notes:    form.notes    || null,
      icon:     form.icon     || "pin",
    })
    .eq("id", locationId)
    .select()
    .single();
  if (error) throw error;
  return normaliseLocation(data);
}

/** Delete a place. */
export async function deleteLocation(locationId) {
  const { error } = await supabase
    .from("locations")
    .delete()
    .eq("id", locationId);
  if (error) throw error;
}

/** Toggle a member's vote on a place. */
export async function toggleVote(locationId, memberName, currentVotes) {
  const has    = currentVotes.includes(memberName);
  const votes  = has
    ? currentVotes.filter((n) => n !== memberName)
    : [...currentVotes, memberName];

  const { data, error } = await supabase
    .from("locations")
    .update({ votes })
    .eq("id", locationId)
    .select()
    .single();
  if (error) throw error;
  return normaliseLocation(data);
}

// ─── ITINERARY ───────────────────────────────────────────────

/** Load saved itinerary for a trip. Returns null if none. */
export async function fetchItinerary(tripId) {
  const { data, error } = await supabase
    .from("itineraries")
    .select("*")
    .eq("trip_id", tripId)
    .maybeSingle();
  if (error) throw error;
  if (!data)  return null;
  return { itinerary: data.itinerary, dayTitles: data.day_titles, dayNotes: data.day_notes || {} };
}

/** Upsert (save or overwrite) the itinerary. */
export async function saveItinerary(tripId, itinerary, dayTitles, dayNotes) {
  const { error } = await supabase
    .from("itineraries")
    .upsert(
      { trip_id: tripId, itinerary, day_titles: dayTitles, day_notes: dayNotes || {} },
      { onConflict: "trip_id" }
    );
  if (error) throw error;
}

// ─── DOCUMENTS ───────────────────────────────────────────────

/** Fetch all documents for a trip. */
export async function fetchDocuments(tripId) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("trip_id", tripId)
    .order("uploaded_at", { ascending: true });
  if (error) throw error;
  return data.map(normaliseDoc);
}

/** Upload a new document (data is a base64 data-url string). */
export async function uploadDocument(tripId, { name, category, type, data, uploadedBy }) {
  const id = uid();
  const { data: row, error } = await supabase
    .from("documents")
    .insert({
      id,
      trip_id:     tripId,
      name,
      category,
      type,
      data,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();
  if (error) throw error;
  return normaliseDoc(row);
}

/** Delete a document. */
export async function deleteDocument(docId) {
  const { error } = await supabase.from("documents").delete().eq("id", docId);
  if (error) throw error;
}

// ─── CHECKLIST ───────────────────────────────────────────────

/** Fetch all checklist items for a trip. */
export async function fetchChecklist(tripId) {
  const { data, error } = await supabase
    .from("checklist_items")
    .select("*")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data.map(normaliseCheckItem);
}

/** Add a checklist item. */
export async function addCheckItem(tripId, text) {
  const id = uid();
  const { data, error } = await supabase
    .from("checklist_items")
    .insert({ id, trip_id: tripId, text, done: false })
    .select()
    .single();
  if (error) throw error;
  return normaliseCheckItem(data);
}

/** Toggle done on a checklist item. */
export async function toggleCheckItem(itemId, done) {
  const { data, error } = await supabase
    .from("checklist_items")
    .update({ done })
    .eq("id", itemId)
    .select()
    .single();
  if (error) throw error;
  return normaliseCheckItem(data);
}

/** Delete a checklist item. */
export async function deleteCheckItem(itemId) {
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) throw error;
}

// ─── SESSION (stays in localStorage — device-only) ───────────
export function saveSession(tripId, member) {
  try { localStorage.setItem(`wb2_session_${tripId}`, JSON.stringify(member)); } catch {}
}
export function loadSession(tripId) {
  try {
    const v = localStorage.getItem(`wb2_session_${tripId}`);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}
export function clearSession(tripId) {
  try { localStorage.removeItem(`wb2_session_${tripId}`); } catch {}
}

// ─── Avatar choice (stays in localStorage — cosmetic only) ───
export function saveAvatarChoice(tripId, memberId, avatar) {
  try { localStorage.setItem(`wb2_av_${tripId}_${memberId}`, JSON.stringify(avatar)); } catch {}
}
export function loadAvatarChoice(tripId, memberId) {
  try {
    const v = localStorage.getItem(`wb2_av_${tripId}_${memberId}`);
    return v ? JSON.parse(v) : null;
  } catch { return null; }
}

// ─── Normalisers (DB row → app shape) ────────────────────────
function normaliseMember(m) {
  return { id: m.id, name: m.name, avatar: m.avatar || null };
}

function normaliseLocation(l) {
  return {
    id:        l.id,
    name:      l.name,
    mapLink:   l.map_link  || "",
    area:      l.area      || "",
    notes:     l.notes     || "",
    icon:      l.icon      || "pin",
    addedBy:   l.added_by  || "",
    votes:     l.votes     || [],
    createdAt: new Date(l.created_at).getTime(),
  };
}

function normaliseDoc(d) {
  return {
    id:         d.id,
    name:       d.name,
    category:   d.category,
    type:       d.type,
    data:       d.data,
    uploadedBy: d.uploaded_by,
    uploadedAt: new Date(d.uploaded_at).getTime(),
  };
}

function normaliseCheckItem(c) {
  return { id: c.id, text: c.text, done: c.done };
}
