'use strict';

const STORAGE_KEY = 'faithful-city-doxa-portal-family-v12-cloud-cache';
const APP_VERSION = 15;
const CLOUD_ROW_ID = 'faithful-city-doxa-portal-family';
const CLOUD_TABLE = 'churchcare_state';

const seedData = {
  "version": 15,
  "settings": {
    "activeThreshold": 60,
    "windowSize": 8,
    "inactiveConsecutive": 4,
    "learningMinimumServices": 3,
    "warningConsecutiveMisses": 2,
    "criticalConsecutiveMisses": 5,
    "currentSemesterId": "sem_2025_2026_2"
  },
  "semesters": [
    {
      "id": "sem_2025_2026_2",
      "name": "Second Semester",
      "academicYear": "2025/2026",
      "calendarYear": "2026",
      "startDate": "2026-06-01",
      "endDate": "2026-08-31",
      "active": true,
      "current": true,
      "notes": "Initial import period created from the uploaded June–July 2026 first-timer records. Dates can be edited in Settings."
    }
  ],
  "programs": [
    {
      "id": "program_sunday",
      "name": "Sunday Service",
      "type": "sunday",
      "recurring": true,
      "defaultDay": 0,
      "countsForActivity": true,
      "active": true,
      "fixed": true,
      "semesterId": "sem_2025_2026_2",
      "semester": "Second Semester 2025/2026",
      "startDate": "",
      "endDate": "",
      "theme": "",
      "venue": "",
      "organizer": "",
      "notes": "Main weekly church service and the service used for automatic active/inactive classification."
    },
    {
      "id": "program_midweek",
      "name": "Thursday Midweek Service",
      "type": "midweek",
      "recurring": true,
      "defaultDay": 4,
      "countsForActivity": false,
      "active": true,
      "fixed": true,
      "semesterId": "sem_2025_2026_2",
      "semester": "Second Semester 2025/2026",
      "startDate": "",
      "endDate": "",
      "theme": "",
      "venue": "",
      "organizer": "",
      "notes": "Weekly midweek gathering, normally held on Thursdays."
    }
  ],
  "members": [],
  "visitors": [],
  "services": [],
  "careNotes": []
};let state = normalizeLoadedState(clone(seedData));
let periodFilter = { academicYear: 'all', calendarYear: 'all', semesterId: state.settings.currentSemesterId || 'all' };
let attendanceDraft = { presentMemberIds: new Set(), visitorIds: new Set(), meta: { topic: '', minister: '', scripture: '', notes: '' } };
let modalSubmitHandler = null;
let bulkSelectedMemberIds = new Set();

const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menuBtn');
const sidebarCloseBtn = document.getElementById('sidebarCloseBtn');
const mobileNavBackdrop = document.getElementById('mobileNavBackdrop');
const mobileMoreBtn = document.getElementById('mobileMoreBtn');
const mobilePeriodBtn = document.getElementById('mobilePeriodBtn');
const toast = document.getElementById('toast');
const modalBackdrop = document.getElementById('modalBackdrop');
const modal = document.getElementById('modal');
const modalBody = document.getElementById('modalBody');
const modalTitle = document.getElementById('modalTitle');
const modalSubtitle = document.getElementById('modalSubtitle');
const modalEyebrow = document.getElementById('modalEyebrow');


function finishOpeningScreen() {
  const screen = document.getElementById('openingScreen');
  if (!screen) return;
  const delay = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 820;
  window.setTimeout(() => screen.classList.add('is-finished'), delay);
  window.setTimeout(() => screen.remove(), delay + 380);
}

function setMobileMenuOpen(open) {
  const shouldOpen = Boolean(open) && window.matchMedia('(max-width: 860px)').matches;
  sidebar?.classList.toggle('open', shouldOpen);
  document.body.classList.toggle('mobile-nav-open', shouldOpen);
  if (mobileNavBackdrop) mobileNavBackdrop.hidden = !shouldOpen;
  menuBtn?.setAttribute('aria-expanded', String(shouldOpen));
  if (shouldOpen) sidebarCloseBtn?.focus({ preventScroll: true });
}

function syncMobileNavigation(pageName) {
  document.querySelectorAll('[data-mobile-go]').forEach(button => button.classList.toggle('active', button.dataset.mobileGo === pageName));
}

function openMobilePeriodFilters() {
  renderPeriodFilters();
  const academic = document.getElementById('periodAcademicYearFilter');
  const calendar = document.getElementById('periodCalendarYearFilter');
  const semester = document.getElementById('periodSemesterFilter');
  if (!academic || !calendar || !semester) return;
  openModal({
    eyebrow: 'Academic period',
    title: 'Choose the records to view',
    subtitle: 'This changes the dashboard, attendance history, programs and reports shown on your phone.',
    body: `<form id="mobilePeriodForm" class="form-grid">
      <label><span>Academic year</span><select id="mobileAcademicYear" class="select-control">${academic.innerHTML}</select></label>
      <label><span>Calendar year</span><select id="mobileCalendarYear" class="select-control">${calendar.innerHTML}</select></label>
      <label><span>Semester</span><select id="mobileSemester" class="select-control">${semester.innerHTML}</select></label>
      <div class="modal-actions"><button class="btn btn-soft" type="button" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Apply period</button></div>
    </form>`,
    onOpen: () => {
      const a = document.getElementById('mobileAcademicYear');
      const c = document.getElementById('mobileCalendarYear');
      const s = document.getElementById('mobileSemester');
      a.value = academic.value;
      c.value = calendar.value;
      s.value = semester.value;
      a.addEventListener('change', () => {
        academic.value = a.value;
        periodFilter.academicYear = a.value;
        renderPeriodFilters();
        s.innerHTML = document.getElementById('periodSemesterFilter').innerHTML;
        s.value = 'all';
      });
      document.getElementById('mobilePeriodForm')?.addEventListener('submit', event => {
        event.preventDefault();
        academic.value = a.value;
        calendar.value = c.value;
        semester.value = s.value;
        updatePeriodFilterFromControls();
        closeModal();
      });
    }
  });
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeMember(member) {
  return {
    ministryStatus: 'current',
    statusChangedDate: null,
    statusNote: '',
    programme: '',
    expectedCompletionYear: '',
    joinedSemesterId: '',
    importSource: '',
    invitedByName: '',
    invitedByMemberId: null,
    classificationBaseline: 'unclassified',
    classificationSource: '',
    ...member
  };
}

function normalizeVisitor(visitor) {
  return { visitorStatus: 'active', archivedDate: null, invitedByName: '', invitedByMemberId: null, firstVisitSemesterId: '', sourceVisitDates: [], notes: '', ...visitor };
}

function normalizeSemester(semester) {
  return {
    name: '', academicYear: '', calendarYear: '', startDate: '', endDate: '', active: true, current: false, notes: '', ...semester
  };
}

function normalizeProgram(program) {
  return {
    type: 'special',
    recurring: false,
    defaultDay: null,
    countsForActivity: false,
    active: true,
    fixed: false,
    semesterId: '',
    semester: '',
    startDate: '',
    endDate: '',
    theme: '',
    venue: '',
    organizer: '',
    notes: '',
    reminderEnabled: false,
    reminderDate: '',
    reminderTime: '09:00',
    reminderMessage: '',
    ...program
  };
}

function buildNormalizedPrograms(parsed) {
  const hasExistingData = Boolean((parsed?.members || []).length || (parsed?.visitors || []).length || (parsed?.services || []).length);
  const fallbackPrograms = hasExistingData ? seedData.programs.filter(program => program.fixed) : seedData.programs;
  const source = Array.isArray(parsed?.programs) && parsed.programs.length
    ? parsed.programs.map(normalizeProgram)
    : clone(fallbackPrograms).map(normalizeProgram);

  const ensureBuiltIn = (id) => {
    if (!source.some(program => program.id === id)) {
      const builtIn = seedData.programs.find(program => program.id === id);
      if (builtIn) source.unshift(normalizeProgram(clone(builtIn)));
    }
  };
  ensureBuiltIn('program_midweek');
  ensureBuiltIn('program_sunday');

  const knownNames = new Set(source.map(program => program.name.toLowerCase()));
  (parsed?.services || []).forEach(record => {
    const name = String(record.service || '').trim();
    if (!name || knownNames.has(name.toLowerCase())) return;
    source.push(normalizeProgram({
      id: uid('program_legacy'),
      name,
      type: /sunday/i.test(name) ? 'sunday' : /midweek|thursday/i.test(name) ? 'midweek' : 'special',
      recurring: /sunday|midweek|thursday/i.test(name),
      countsForActivity: /sunday/i.test(name),
      active: true,
      notes: 'Imported from an earlier ChurchCare attendance record.'
    }));
    knownNames.add(name.toLowerCase());
  });
  return source;
}

function normalizeServiceRecord(record, programs) {
  let program = programs.find(item => item.id === record.programId);
  if (!program) {
    const serviceName = String(record.service || '').trim().toLowerCase();
    program = programs.find(item => item.name.toLowerCase() === serviceName);
  }
  if (!program && /sunday/i.test(record.service || '')) program = programs.find(item => item.id === 'program_sunday');
  if (!program && /midweek|thursday/i.test(record.service || '')) program = programs.find(item => item.id === 'program_midweek');

  return {
    topic: '',
    minister: '',
    scripture: '',
    notes: '',
    semesterId: '',
    academicYear: '',
    calendarYear: record.date ? String(record.date).slice(0, 4) : '',
    programId: program?.id || null,
    service: program?.name || record.service || 'Church Program',
    eventType: program?.type || record.eventType || 'special',
    presentMemberIds: [],
    visitorIds: [],
    ...record,
    programId: program?.id || record.programId || null,
    service: program?.name || record.service || 'Church Program',
    eventType: program?.type || record.eventType || 'special'
  };
}

function normalizeLoadedState(parsed) {
  const programs = buildNormalizedPrograms(parsed || {});
  const semesters = (Array.isArray(parsed?.semesters) && parsed.semesters.length ? parsed.semesters : clone(seedData.semesters)).map(normalizeSemester);
  const settings = { ...clone(seedData.settings), ...(parsed?.settings || {}) };
  if (!settings.currentSemesterId || !semesters.some(item => item.id === settings.currentSemesterId)) {
    settings.currentSemesterId = semesters.find(item => item.current)?.id || semesters.find(item => item.active !== false)?.id || '';
  }
  return {
    ...clone(seedData),
    ...parsed,
    version: APP_VERSION,
    settings,
    semesters,
    programs,
    members: (parsed?.members || []).map(normalizeMember),
    visitors: (parsed?.visitors || []).map(normalizeVisitor),
    services: (parsed?.services || []).map(record => normalizeServiceRecord(record, programs)),
    careNotes: parsed?.careNotes || []
  };
}

function loadCachedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return normalizeLoadedState(clone(seedData));
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.members) || !Array.isArray(parsed.services)) return normalizeLoadedState(clone(seedData));
    return normalizeLoadedState(parsed);
  } catch (error) {
    console.error('Could not load the local ChurchCare cache:', error);
    return normalizeLoadedState(clone(seedData));
  }
}

let supabaseClient = null;
let currentSession = null;
let cloudReady = false;
let cloudSaveTimer = null;
let cloudSaveChain = Promise.resolve();

function getSupabaseConfig() {
  const config = window.CHURCHCARE_SUPABASE || {};
  return {
    url: String(config.url || '').trim(),
    publishableKey: String(config.publishableKey || config.anonKey || '').trim()
  };
}

function isConfiguredValue(value) {
  return value && !/PASTE_|YOUR_|EXAMPLE/i.test(value);
}

function setAuthMessage(message, isError = false) {
  const target = document.getElementById('authMessage');
  if (!target) return;
  target.textContent = message || '';
  target.classList.toggle('auth-error', Boolean(isError));
}

function setAuthBusy(isBusy) {
  document.getElementById('authLoginBtn')?.toggleAttribute('disabled', isBusy);
  document.getElementById('authEmail')?.toggleAttribute('disabled', isBusy);
  document.getElementById('authPassword')?.toggleAttribute('disabled', isBusy);
}

function showAuthGate(mode = 'login') {
  const gate = document.getElementById('authGate');
  if (!gate) return;
  gate.hidden = false;
  document.body.classList.add('auth-locked');
  const setup = document.getElementById('authSetupHelp');
  const form = document.getElementById('authLoginForm');
  if (setup) setup.hidden = mode !== 'setup';
  if (form) form.hidden = mode === 'setup';
}

function hideAuthGate() {
  const gate = document.getElementById('authGate');
  if (gate) gate.hidden = true;
  document.body.classList.remove('auth-locked');
}

function updateSignedInUser(session) {
  const email = session?.user?.email || 'Signed in';
  const emailNode = document.getElementById('signedInEmail');
  const roleNode = document.getElementById('signedInRole');
  if (emailNode) emailNode.textContent = email;
  if (roleNode) roleNode.textContent = 'Shared cloud access';
}

async function loadStateFromCloud() {
  if (!supabaseClient || !currentSession) throw new Error('Not signed in to Supabase.');

  const { data, error } = await supabaseClient
    .from(CLOUD_TABLE)
    .select('data, updated_at')
    .eq('id', CLOUD_ROW_ID)
    .maybeSingle();

  if (error) throw error;

  if (data?.data) {
    state = normalizeLoadedState(data.data);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return;
  }

  // No shared row exists yet. Start with an empty public-safe state.
  state = normalizeLoadedState(clone(seedData));
  await persistStateToCloud(clone(state));
}

async function persistStateToCloud(snapshot) {
  if (!supabaseClient || !currentSession) return;
  const payload = {
    id: CLOUD_ROW_ID,
    data: snapshot,
    updated_at: new Date().toISOString(),
    updated_by: currentSession.user.id
  };
  const { error } = await supabaseClient.from(CLOUD_TABLE).upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

function queueCloudSave() {
  if (!cloudReady || !supabaseClient || !currentSession) return;
  const snapshot = clone(state);
  cloudSaveChain = cloudSaveChain
    .catch(() => {})
    .then(() => persistStateToCloud(snapshot))
    .catch(error => {
      console.error('Cloud save failed:', error);
      showToast('Cloud save failed. Check your internet connection and Supabase setup.');
    });
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  if (!cloudReady) return;
  clearTimeout(cloudSaveTimer);
  cloudSaveTimer = setTimeout(queueCloudSave, 250);
}

async function signInToChurchCare(event) {
  event?.preventDefault();
  if (!supabaseClient) return;
  const email = document.getElementById('authEmail')?.value.trim();
  const password = document.getElementById('authPassword')?.value || '';
  if (!email || !password) {
    setAuthMessage('Enter both your email address and password.', true);
    return;
  }

  setAuthBusy(true);
  setAuthMessage('Signing in…');
  const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
  setAuthBusy(false);

  if (error) {
    setAuthMessage(error.message || 'Sign-in failed.', true);
    return;
  }

  currentSession = data.session;
  await completeAuthenticatedStartup();
}

async function completeAuthenticatedStartup() {
  try {
    setAuthMessage('Loading shared ministry data…');
    cloudReady = false;
    await loadStateFromCloud();
    currentSession = (await supabaseClient.auth.getSession()).data.session;
    updateSignedInUser(currentSession);
    periodFilter = { academicYear: 'all', calendarYear: 'all', semesterId: state.settings.currentSemesterId || 'all' };
    loadAttendanceDraft();
    renderAll();
    cloudReady = true;
    hideAuthGate();
    showToast('Connected to the shared Supabase ministry database.');
  } catch (error) {
    console.error('Could not start ChurchCare cloud mode:', error);
    setAuthMessage(`Could not load the shared database: ${error.message || error}`, true);
    showAuthGate('login');
  }
}

async function signOutOfChurchCare() {
  if (!supabaseClient) return;
  cloudReady = false;
  await supabaseClient.auth.signOut();
  currentSession = null;
  localStorage.removeItem(STORAGE_KEY);
  state = normalizeLoadedState(clone(seedData));
  periodFilter = { academicYear: 'all', calendarYear: 'all', semesterId: state.settings.currentSemesterId || 'all' };
  renderAll();
  showAuthGate('login');
  setAuthMessage('Signed out.');
}

async function bootstrapSupabaseApp() {
  const { url, publishableKey } = getSupabaseConfig();
  if (!window.supabase?.createClient || !isConfiguredValue(url) || !isConfiguredValue(publishableKey)) {
    showAuthGate('setup');
    setAuthMessage('Supabase is not configured yet.', true);
    return;
  }

  supabaseClient = window.supabase.createClient(url, publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  const { data: { session }, error } = await supabaseClient.auth.getSession();
  if (error) console.error('Supabase session error:', error);

  if (session) {
    currentSession = session;
    await completeAuthenticatedStartup();
  } else {
    state = loadCachedState();
    renderAll();
    showAuthGate('login');
  }

  supabaseClient.auth.onAuthStateChange((event, sessionNow) => {
    if (event === 'SIGNED_OUT') {
      currentSession = null;
      cloudReady = false;
      showAuthGate('login');
    } else if (sessionNow) {
      currentSession = sessionNow;
      updateSignedInUser(sessionNow);
    }
  });
}

function uid(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHTML(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function isoToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function parseISODate(dateString) {
  return new Date(`${dateString}T12:00:00`);
}

function formatDate(dateString, options = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!dateString) return '—';
  return new Intl.DateTimeFormat('en-GB', options).format(parseISODate(dateString));
}

function formatLongToday() {
  return new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date());
}

function initials(name) {
  return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase() || 'FC';
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.__churchCareToast);
  window.__churchCareToast = setTimeout(() => toast.classList.remove('show'), 2600);
}

function getMember(id) {
  return state.members.find(member => member.id === id);
}

function getVisitor(id) {
  return state.visitors.find(visitor => visitor.id === id);
}

function getProgram(id) {
  return state.programs.find(program => program.id === id);
}

function getProgramForRecord(record) {
  return getProgram(record?.programId) || state.programs.find(program => program.name === record?.service) || null;
}

function getSemester(id) {
  return state.semesters?.find(semester => semester.id === id) || null;
}

function getCurrentSemester() {
  return getSemester(state.settings.currentSemesterId) || state.semesters?.find(semester => semester.current) || state.semesters?.find(semester => semester.active !== false) || null;
}

function semesterFullLabel(semester) {
  if (!semester) return 'Unassigned period';
  return [semester.name, semester.academicYear].filter(Boolean).join(' ') || 'Unnamed semester';
}

function getSemesterForDate(date) {
  if (!date) return getCurrentSemester();
  const matching = (state.semesters || []).filter(semester => semester.startDate && semester.endDate && date >= semester.startDate && date <= semester.endDate);
  return matching[0] || getCurrentSemester();
}

function getRecordSemester(record) {
  return getSemester(record?.semesterId) || getSemesterForDate(record?.date);
}

function getProgramSemester(program) {
  return getSemester(program?.semesterId) || getSemesterForDate(program?.startDate);
}

function getVisitorSemester(visitor) {
  return getSemester(visitor?.firstVisitSemesterId) || getSemesterForDate(visitor?.firstVisit);
}

function recordMatchesPeriod(record) {
  const semester = getRecordSemester(record);
  const calendarYear = record?.calendarYear || (record?.date ? String(record.date).slice(0, 4) : '');
  if (periodFilter.academicYear !== 'all' && semester?.academicYear !== periodFilter.academicYear) return false;
  if (periodFilter.calendarYear !== 'all' && calendarYear !== periodFilter.calendarYear) return false;
  if (periodFilter.semesterId !== 'all' && semester?.id !== periodFilter.semesterId) return false;
  return true;
}

function visitorMatchesPeriod(visitor) {
  const semester = getVisitorSemester(visitor);
  const calendarYear = visitor?.firstVisit ? String(visitor.firstVisit).slice(0, 4) : semester?.calendarYear || '';
  if (periodFilter.academicYear !== 'all' && semester?.academicYear !== periodFilter.academicYear) return false;
  if (periodFilter.calendarYear !== 'all' && calendarYear !== periodFilter.calendarYear) return false;
  if (periodFilter.semesterId !== 'all' && semester?.id !== periodFilter.semesterId) return false;
  return true;
}

function programMatchesPeriod(program) {
  const semester = getProgramSemester(program);
  const calendarYear = program?.startDate ? String(program.startDate).slice(0, 4) : semester?.calendarYear || '';
  if (program.type !== 'special') return true;
  if (periodFilter.academicYear !== 'all' && semester?.academicYear !== periodFilter.academicYear) return false;
  if (periodFilter.calendarYear !== 'all' && calendarYear !== periodFilter.calendarYear) return false;
  if (periodFilter.semesterId !== 'all' && semester?.id !== periodFilter.semesterId) return false;
  return true;
}

function getPeriodServices() {
  return state.services.filter(recordMatchesPeriod);
}

function getPeriodVisitors() {
  return state.visitors.filter(visitorMatchesPeriod);
}

function getActivitySemesterId() {
  return state.settings.currentSemesterId || '';
}

function semesterOptions(selectedId = '', includeAll = false) {
  const options = (state.semesters || []).slice().sort((a,b) => (b.startDate || '').localeCompare(a.startDate || '')).map(semester => `<option value="${semester.id}" ${selectedId === semester.id ? 'selected' : ''}>${escapeHTML(semesterFullLabel(semester))}</option>`).join('');
  return `${includeAll ? '<option value="all">All semesters</option>' : '<option value="">Choose semester</option>'}${options}`;
}

function programTypeLabel(type) {
  if (type === 'sunday') return 'Sunday main service';
  if (type === 'midweek') return 'Thursday midweek';
  return 'Special program';
}

function programTypeShortLabel(type) {
  if (type === 'sunday') return 'Sunday';
  if (type === 'midweek') return 'Thursday';
  return 'Special';
}

function getActivePrograms() {
  return state.programs.filter(program => program.active !== false).sort((a, b) => {
    const rank = { sunday: 0, midweek: 1, special: 2 };
    return (rank[a.type] ?? 9) - (rank[b.type] ?? 9) || a.name.localeCompare(b.name);
  });
}

function getProgramRecords(programId) {
  return state.services.filter(record => record.programId === programId && recordMatchesPeriod(record)).sort((a, b) => b.date.localeCompare(a.date));
}

function getSpecialPrograms() {
  return state.programs.filter(program => program.type === 'special').sort((a, b) => {
    const aDate = a.startDate || '9999-12-31';
    const bDate = b.startDate || '9999-12-31';
    return aDate.localeCompare(bDate) || a.name.localeCompare(b.name);
  });
}

function getProgramReminderDateTime(program) {
  if (!program?.reminderEnabled || !program.reminderDate) return null;
  const time = /^\d{2}:\d{2}$/.test(program.reminderTime || '') ? program.reminderTime : '09:00';
  const value = new Date(`${program.reminderDate}T${time}:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function getProgramStartDateTime(program) {
  if (!program?.startDate) return null;
  const value = new Date(`${program.startDate}T00:00:00`);
  return Number.isNaN(value.getTime()) ? null : value;
}

function daysUntil(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function programCountdownText(program) {
  const start = getProgramStartDateTime(program);
  const days = daysUntil(start);
  if (days === null) return 'Program date not set';
  if (days < 0) return program.endDate && program.endDate >= isoToday() ? 'Ongoing now' : 'Program date passed';
  if (days === 0) return 'Starts today';
  if (days === 1) return 'Starts tomorrow';
  return `Starts in ${days} days`;
}

function getUpcomingSpecialPrograms(days = 120) {
  const today = isoToday();
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  end.setDate(end.getDate() + days);
  return state.programs
    .filter(program => program.type === 'special' && program.active !== false && program.startDate)
    .filter(program => {
      const programEnd = program.endDate || program.startDate;
      const start = getProgramStartDateTime(program);
      return programEnd >= today && start && start <= end;
    })
    .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.name.localeCompare(b.name));
}

function getDueProgramReminders() {
  const now = new Date();
  return getUpcomingSpecialPrograms(365).filter(program => {
    const reminderAt = getProgramReminderDateTime(program);
    return reminderAt && reminderAt <= now;
  });
}

function formatReminderDateTime(program) {
  const reminderAt = getProgramReminderDateTime(program);
  if (!reminderAt) return 'Reminder not set';
  return new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  }).format(reminderAt);
}

function reminderStorageKey(program) {
  return `churchcare-program-reminder:${program.id}:${program.reminderDate || ''}:${program.reminderTime || ''}`;
}

function renderReminderItems(programs, compact = false) {
  if (!programs.length) return '<div class="empty-state">No upcoming special programs with dates have been added.</div>';
  return programs.map(program => {
    const reminderAt = getProgramReminderDateTime(program);
    const due = reminderAt && reminderAt <= new Date();
    const reminderCopy = program.reminderEnabled && reminderAt
      ? `${due ? 'Reminder due' : 'Reminder'}: ${formatReminderDateTime(program)}`
      : 'No reminder set — edit the program to add one';
    return `<button class="program-reminder-item ${due ? 'reminder-due' : ''}" data-program-open="${program.id}">
      <span class="reminder-symbol">${due ? '!' : '✦'}</span>
      <span class="reminder-copy">
        <strong>${escapeHTML(program.name)}</strong>
        <small>${escapeHTML([formatDate(program.startDate), program.venue, programCountdownText(program)].filter(Boolean).join(' • '))}</small>
        ${compact ? '' : `<em>${escapeHTML(reminderCopy)}</em>`}
      </span>
      <span class="reminder-status ${program.reminderEnabled ? (due ? 'due' : 'set') : 'unset'}">${program.reminderEnabled ? (due ? 'Due' : 'Set') : 'Set reminder'}</span>
    </button>`;
  }).join('');
}

function updateProgramReminderUI() {
  const upcoming = getUpcomingSpecialPrograms(120);
  const dashboard = document.getElementById('dashboardProgramReminders');
  const list = document.getElementById('programReminderList');
  if (dashboard) dashboard.innerHTML = renderReminderItems(upcoming.slice(0, 5), true);
  if (list) list.innerHTML = renderReminderItems(upcoming, false);

  const badge = document.getElementById('programReminderBadge');
  if (badge) {
    const due = getDueProgramReminders().length;
    badge.textContent = due || upcoming.filter(program => program.reminderEnabled).length || '0';
    badge.classList.toggle('has-due', due > 0);
  }
}

function openProgramRemindersModal() {
  const upcoming = getUpcomingSpecialPrograms(180);
  openModal({
    eyebrow: 'Ministry calendar',
    title: 'Upcoming program reminders',
    subtitle: 'Open a program to review it, take attendance, or edit its reminder.',
    wide: true,
    body: `<div class="program-reminder-list modal-reminder-list">${renderReminderItems(upcoming, false)}</div>
      <div class="modal-actions"><button class="btn btn-soft" data-modal-cancel>Close</button><button class="btn btn-gold" id="modalOpenPrograms">Manage programs</button></div>`,
    onOpen: () => document.getElementById('modalOpenPrograms')?.addEventListener('click', () => { closeModal(); switchPage('programs'); })
  });
}

async function requestProgramNotificationPermission() {
  if (!('Notification' in window)) return showToast('This browser does not support desktop notifications. In-app reminders will still work.');
  if (Notification.permission === 'granted') return showToast('Browser program alerts are already enabled.');
  const permission = await Notification.requestPermission();
  showToast(permission === 'granted' ? 'Browser program alerts enabled.' : 'Browser alerts were not enabled. In-app reminders remain available.');
  if (permission === 'granted') checkProgramReminders(true);
}

function checkProgramReminders(force = false) {
  const duePrograms = getDueProgramReminders();
  if (!duePrograms.length) return;
  duePrograms.forEach(program => {
    const key = reminderStorageKey(program);
    if (!force && localStorage.getItem(key)) return;
    const message = program.reminderMessage || `${program.name} is coming up on ${formatDate(program.startDate)}${program.venue ? ` at ${program.venue}` : ''}.`;
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(`ChurchCare reminder: ${program.name}`, {
          body: message,
          icon: 'assets/favicon.png',
          tag: key
        });
      } catch (error) {
        console.warn('Browser notification failed:', error);
      }
    }
    localStorage.setItem(key, new Date().toISOString());
  });
  if (duePrograms.length) showToast(`${duePrograms.length} program reminder${duePrograms.length === 1 ? ' is' : 's are'} due. Open Programs & Topics.`);
  updateProgramReminderUI();
}

function getMemberMinistryStatus(member) {
  return member?.ministryStatus || 'current';
}

function ministryStatusLabel(status) {
  const labels = {
    current: 'Current member',
    completed: 'Completed school',
    transferred: 'Transferred',
    withdrawn: 'Left ministry',
    archived: 'Archived'
  };
  return labels[status] || 'Current member';
}

function ministryStatusClass(status) {
  return status === 'current' ? 'watch' : status === 'completed' ? 'completion-status' : status === 'transferred' ? 'new-status' : status === 'withdrawn' ? 'medium' : 'archived-status';
}

function isCurrentMember(member) {
  return getMemberMinistryStatus(member) === 'current';
}

function isMemberEligibleOnDate(member, date) {
  if (!member || member.joinedDate > date) return false;
  if (isCurrentMember(member)) return true;
  const changed = member.statusChangedDate;
  return Boolean(changed && date < changed);
}

function getCurrentMembers() {
  return state.members.filter(isCurrentMember);
}

function getActiveVisitors() {
  return state.visitors.filter(visitor => (visitor.visitorStatus || 'active') === 'active');
}

function getShepherds() {
  return state.members.filter(member => member.role === 'shepherd' && isCurrentMember(member)).sort((a, b) => a.name.localeCompare(b.name));
}

function getSundayRecords() {
  const activitySemesterId = getActivitySemesterId();
  return state.services
    .filter(record => {
      const program = getProgramForRecord(record);
      const isSunday = program?.countsForActivity === true || record.eventType === 'sunday' || record.service === 'Sunday Service';
      const semester = getRecordSemester(record);
      return isSunday && (!activitySemesterId || semester?.id === activitySemesterId);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function getPeriodSundayRecords() {
  return getPeriodServices().filter(record => {
    const program = getProgramForRecord(record);
    return program?.countsForActivity === true || record.eventType === 'sunday' || record.service === 'Sunday Service';
  }).sort((a, b) => b.date.localeCompare(a.date));
}


function getClassificationRecords(eventType) {
  const semesterId = getActivitySemesterId();
  return state.services
    .filter(record => {
      const program = getProgramForRecord(record);
      const type = program?.type || record.eventType;
      const matches = eventType === 'sunday'
        ? (program?.countsForActivity === true || type === 'sunday' || record.service === 'Sunday Service')
        : (type === 'midweek' || /thursday|midweek/i.test(record.service || ''));
      const semester = getRecordSemester(record);
      return matches && (!semesterId || semester?.id === semesterId);
    })
    .sort((a, b) => b.date.localeCompare(a.date));
}

function countConsecutiveMisses(member, eventType) {
  const records = getClassificationRecords(eventType).filter(record => isMemberEligibleOnDate(member, record.date));
  let misses = 0;
  for (const record of records) {
    if (record.presentMemberIds.includes(member.id)) break;
    misses += 1;
  }
  return { misses, records };
}

function classificationLabel(zone) {
  return zone === 'active' ? 'Active' : zone === 'green' ? 'Needs Help — Green' : zone === 'red' ? 'Urgent Contact — Red' : 'Unclassified';
}

function classificationClass(zone) {
  return zone === 'active' ? 'classification-active' : zone === 'green' ? 'classification-green' : zone === 'red' ? 'classification-red' : 'classification-unclassified';
}

function getMemberClassification(member) {
  if (!isCurrentMember(member)) return { zone: 'archived', sundayMisses: 0, thursdayMisses: 0, reason: 'Not in the current ministry roster', adminMessage: '' };
  const sunday = countConsecutiveMisses(member, 'sunday');
  const thursday = countConsecutiveMisses(member, 'midweek');
  const warning = Number(state.settings.warningConsecutiveMisses || 2);
  const critical = Number(state.settings.criticalConsecutiveMisses || 5);
  const maxMisses = Math.max(sunday.misses, thursday.misses);
  const dominantMeeting = sunday.misses >= thursday.misses ? 'Sunday services' : 'Thursday meetings';
  const allRecords = [...sunday.records, ...thursday.records];
  const hasPresentRecord = allRecords.some(record => record.presentMemberIds.includes(member.id));
  const baseline = ['active','green','red'].includes(member.classificationBaseline) ? member.classificationBaseline : 'unclassified';

  let zone;
  if (maxMisses >= critical) zone = 'red';
  else if (maxMisses >= warning) zone = 'green';
  else if (hasPresentRecord) zone = 'active';
  else zone = baseline;

  let reason = '';
  let adminMessage = '';
  if (zone === 'red' && maxMisses >= critical) {
    reason = `Missed ${maxMisses} consecutive ${dominantMeeting}`;
    adminMessage = `${member.name} has missed meeting ${maxMisses} times consecutively and must be contacted immediately.`;
  } else if (zone === 'green' && maxMisses >= warning) {
    reason = `Missed ${maxMisses} consecutive ${dominantMeeting}`;
    adminMessage = `${member.name} has missed meeting twice and needs help. Please alert the responsible shepherd.`;
  } else if (zone === 'red') {
    reason = 'Imported in the urgent-contact list';
    adminMessage = `${member.name} was imported as urgent and should be contacted immediately.`;
  } else if (zone === 'green') {
    reason = 'Imported in the needs-help list';
    adminMessage = `${member.name} was imported as needing help. Please check in through the responsible shepherd.`;
  } else if (zone === 'active') {
    reason = hasPresentRecord ? 'Attendance currently stable' : 'Imported in the active list';
  } else {
    reason = 'No initial classification or attendance pattern yet';
  }
  return { zone, sundayMisses: sunday.misses, thursdayMisses: thursday.misses, maxMisses, reason, adminMessage };
}

function getClassificationMembers() {
  const rank = { red: 4, green: 3, unclassified: 2, active: 1 };
  return getCurrentMembers().map(member => ({ member, classification: getMemberClassification(member) }))
    .sort((a,b) => rank[b.classification.zone] - rank[a.classification.zone] || a.member.name.localeCompare(b.member.name));
}

function getMemberMetrics(member) {
  const settings = state.settings;
  const eligible = getSundayRecords().filter(record => isMemberEligibleOnDate(member, record.date)).slice(0, settings.windowSize);
  const presentCount = eligible.filter(record => record.presentMemberIds.includes(member.id)).length;
  const opportunities = eligible.length;
  const rate = opportunities ? Math.round((presentCount / opportunities) * 100) : 0;
  const attendedRecords = state.services.filter(record => record.presentMemberIds.includes(member.id)).sort((a, b) => b.date.localeCompare(a.date));
  const lastAttended = attendedRecords[0]?.date || null;
  const classification = getMemberClassification(member);
  const status = classification.zone === 'active' ? 'active' : ['green','red'].includes(classification.zone) ? 'inactive' : 'new';
  const carePriority = classification.zone === 'red' ? 'high' : classification.zone === 'green' ? 'medium' : 'none';
  return {
    rate, presentCount, opportunities,
    consecutiveAbsences: Math.max(classification.sundayMisses, classification.thursdayMisses),
    sundayConsecutiveAbsences: classification.sundayMisses,
    thursdayConsecutiveAbsences: classification.thursdayMisses,
    lastAttended, status, carePriority,
    classificationZone: classification.zone,
    classificationReason: classification.reason,
    adminMessage: classification.adminMessage
  };
}

function statusLabel(status) {
  return status === 'active' ? 'Active' : status === 'inactive' ? 'Inactive' : 'New / learning';
}

function statusClass(status) {
  return status === 'active' ? 'watch' : status === 'inactive' ? 'high' : 'new-status';
}

function priorityLabel(priority) {
  return priority === 'high' ? 'High priority' : priority === 'medium' ? 'Medium priority' : priority === 'watch' ? 'Watch' : 'Stable';
}

function priorityClass(priority) {
  return priority === 'high' ? 'high' : priority === 'medium' ? 'medium' : 'watch';
}

function getCareMembers() {
  return getCurrentMembers()
    .map(member => ({ member, metrics: getMemberMetrics(member) }))
    .filter(item => item.metrics.carePriority !== 'none')
    .sort((a, b) => {
      const rank = { high: 3, medium: 2, watch: 1, none: 0 };
      return rank[b.metrics.carePriority] - rank[a.metrics.carePriority] || a.metrics.rate - b.metrics.rate;
    });
}

function getLatestServiceRecord() {
  return [...getPeriodServices()].sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}

function getUpcomingBirthdays(days = 30) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();

  return getCurrentMembers().map(member => {
    const dob = parseISODate(member.dob);
    let next = new Date(currentYear, dob.getMonth(), dob.getDate());
    if (next < today) next = new Date(currentYear + 1, dob.getMonth(), dob.getDate());
    const daysAway = Math.round((next - today) / 86400000);
    return { member, next, daysAway };
  }).filter(item => item.daysAway <= days).sort((a, b) => a.daysAway - b.daysAway);
}

function getBirthdayText(daysAway) {
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  return `In ${daysAway} days`;
}

function getAbsentees(record) {
  return state.members.filter(member => isMemberEligibleOnDate(member, record.date) && !record.presentMemberIds.includes(member.id));
}

function getPresentEligibleMembers(record) {
  return state.members.filter(member => isMemberEligibleOnDate(member, record.date) && record.presentMemberIds.includes(member.id));
}

function getRecordStats(record) {
  const eligibleMembers = state.members.filter(member => isMemberEligibleOnDate(member, record.date));
  const present = record.presentMemberIds.filter(id => eligibleMembers.some(member => member.id === id)).length;
  const absent = Math.max(0, eligibleMembers.length - present);
  const visitors = record.visitorIds?.length || 0;
  const total = present + visitors;
  const rate = eligibleMembers.length ? Math.round((present / eligibleMembers.length) * 100) : 0;
  return { present, absent, visitors, total, rate, eligible: eligibleMembers.length };
}

function getMemberShepherd(member) {
  return member.shepherdId ? getMember(member.shepherdId) : null;
}

function switchPage(pageName) {
  const target = document.getElementById(`page-${pageName}`);
  if (!target) return;

  document.querySelectorAll('.page-section').forEach(page => page.classList.remove('active'));
  target.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(nav => nav.classList.toggle('active', nav.dataset.section === pageName));
  syncMobileNavigation(pageName);
  setMobileMenuOpen(false);
  window.scrollTo({ top: 0, behavior: window.matchMedia('(max-width: 860px)').matches ? 'auto' : 'smooth' });
  history.replaceState(null, '', `#${pageName}`);

  if (pageName === 'attendance') loadAttendanceDraft();
  renderAll();
}

function statCard(label, value, note, icon = '•', extraClass = '') {
  return `<article class="stat-card ${extraClass}">
    <div class="stat-top"><span>${escapeHTML(label)}</span><div class="stat-icon">${icon}</div></div>
    <strong>${escapeHTML(value)}</strong><p>${note}</p>
  </article>`;
}

function renderAll() {
  renderDashboard();
  renderMembers();
  renderClassification();
  renderVisitors();
  renderShepherds();
  renderAttendance();
  renderPrograms();
  renderHistory();
  renderCare();
  renderReports();
  renderSettings();
  renderFilterOptions();
}

function renderDashboard() {
  const latest = getLatestServiceRecord();
  const latestStats = latest ? getRecordStats(latest) : { present: 0, absent: 0, visitors: 0, total: 0, rate: 0 };
  const careMembers = getCareMembers();
  const classificationItems = getClassificationMembers();
  const activeCount = classificationItems.filter(item => item.classification.zone === 'active').length;
  const greenCount = classificationItems.filter(item => item.classification.zone === 'green').length;
  const redCount = classificationItems.filter(item => item.classification.zone === 'red').length;
  const inactiveCount = greenCount + redCount;

  document.getElementById('dashboardStats').innerHTML = [
    statCard('Current Members', getCurrentMembers().length, `${activeCount} active • ${greenCount} green • ${redCount} red`, '♙'),
    statCard('Latest Attendance', latestStats.total, latest ? `${formatDate(latest.date)} • ${escapeHTML(latest.service)}` : 'No record yet', '✓'),
    statCard('Visitors / New', latestStats.visitors, latest ? `Included in total attendance` : 'No record yet', '+'),
    statCard('Need Follow-Up', careMembers.length, `<span class="trend alert">${careMembers.filter(item => item.metrics.carePriority === 'high').length} high priority</span>`, '♡', 'priority-stat')
  ].join('');

  const sundayRecords = getPeriodSundayRecords().slice(0, 8).reverse();
  document.getElementById('attendanceTrend').innerHTML = sundayRecords.length ? sundayRecords.map(record => {
    const stats = getRecordStats(record);
    return `<div><span>${formatDate(record.date, { day: 'numeric', month: 'short' })}</span><i style="--value:${stats.rate}%"></i><strong>${stats.rate}%</strong></div>`;
  }).join('') : '<div class="empty-state">No Sunday attendance records yet.</div>';

  document.getElementById('dashboardCareList').innerHTML = careMembers.length ? careMembers.slice(0, 4).map(({ member, metrics }) => {
    const shepherd = getMemberShepherd(member);
    return `<button class="care-person care-person-button" data-member-care="${member.id}">
      <div class="member-avatar">${initials(member.name)}</div>
      <div class="care-info"><strong>${escapeHTML(member.name)}</strong><span>${escapeHTML(metrics.classificationReason)} • ${metrics.rate}% Sunday attendance${shepherd ? ` • ${escapeHTML(shepherd.name)}` : ''}</span></div>
      <span class="priority ${priorityClass(metrics.carePriority)}">${priorityLabel(metrics.carePriority)}</span>
    </button>`;
  }).join('') : '<div class="empty-state">No members currently need attendance-based follow-up.</div>';

  const birthdays = getUpcomingBirthdays(30);
  document.getElementById('birthdayList').innerHTML = birthdays.length ? birthdays.slice(0, 6).map(({ member, next, daysAway }) => `<div class="birthday-item">
    <span class="member-avatar">${initials(member.name)}</span>
    <div><strong>${escapeHTML(member.name)}</strong><small>${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(next)} • ${getBirthdayText(daysAway)}</small></div>
    <span class="birthday-cake">✦</span>
  </div>`).join('') : '<div class="empty-state">No birthdays in the next 30 days.</div>';

  updateProgramReminderUI();

  const shepherds = getShepherds();
  document.getElementById('shepherdHealthList').innerHTML = shepherds.length ? shepherds.map(shepherd => {
    const flock = getCurrentMembers().filter(member => member.shepherdId === shepherd.id);
    const irregular = flock.filter(member => getMemberMetrics(member).status === 'inactive' || getMemberMetrics(member).carePriority === 'high').length;
    return `<button class="shepherd-health-item" data-shepherd-open="${shepherd.id}">
      <span class="member-avatar">${initials(shepherd.name)}</span>
      <div><strong>${escapeHTML(shepherd.name)}</strong><small>${flock.length} assigned • ${irregular} needing attention</small></div>
      <span class="priority ${irregular ? 'medium' : 'watch'}">${irregular ? `${irregular} to check` : 'Stable'}</span>
    </button>`;
  }).join('') : '<div class="empty-state">No shepherds registered yet.</div>';

  const birthdayCount = birthdays.length;
  document.getElementById('birthdayDot').style.display = birthdayCount ? '' : 'none';
  document.getElementById('careNavBadge').textContent = careMembers.length;
  document.getElementById('visitorNavBadge').textContent = getActiveVisitors().length;
}

function renderMembers() {
  const currentMembers = getCurrentMembers();
  const metrics = currentMembers.map(member => getMemberMetrics(member));
  const active = metrics.filter(item => item.status === 'active').length;
  const inactive = metrics.filter(item => item.status === 'inactive').length;
  const learning = metrics.filter(item => item.status === 'new').length;
  const former = state.members.length - currentMembers.length;

  document.getElementById('memberStats').innerHTML = [
    statCard('Current Members', currentMembers.length, `${state.members.length} total historical records`, '♙'),
    statCard('Active', active, 'Stable or fewer than two consecutive misses', '✓'),
    statCard('Needs Attention', inactive, 'Green or red attendance classification', '♡'),
    statCard('Former / Archived', former, `${learning} current member${learning === 1 ? '' : 's'} still learning`, '◷')
  ].join('');

  const query = (document.getElementById('memberSearch')?.value || '').trim().toLowerCase();
  const lifecycleFilter = document.getElementById('memberLifecycleFilter')?.value || 'current';
  const statusFilter = document.getElementById('memberStatusFilter')?.value || 'all';
  const shepherdFilter = document.getElementById('memberShepherdFilter')?.value || 'all';

  const filtered = state.members.filter(member => {
    const memberMetrics = getMemberMetrics(member);
    const shepherd = getMemberShepherd(member);
    const lifecycle = getMemberMinistryStatus(member);
    const haystack = `${member.name} ${member.phone} ${shepherd?.name || ''} ${statusLabel(memberMetrics.status)} ${ministryStatusLabel(lifecycle)} ${member.role} ${member.programme || ''} ${member.expectedCompletionYear || ''}`.toLowerCase();
    const lifecycleMatch = lifecycleFilter === 'all' || lifecycle === lifecycleFilter;
    const statusMatch = statusFilter === 'all' || memberMetrics.status === statusFilter;
    const shepherdMatch = shepherdFilter === 'all' || (shepherdFilter === 'unassigned' ? !member.shepherdId && member.role !== 'shepherd' : member.shepherdId === shepherdFilter || member.id === shepherdFilter);
    return haystack.includes(query) && lifecycleMatch && statusMatch && shepherdMatch;
  }).sort((a, b) => Number(b.priorityContact) - Number(a.priorityContact) || a.name.localeCompare(b.name));

  document.getElementById('membersTableBody').innerHTML = filtered.length ? filtered.map(member => {
    const memberMetrics = getMemberMetrics(member);
    const shepherd = getMemberShepherd(member);
    const lifecycle = getMemberMinistryStatus(member);
    const priorityMark = member.priorityContact ? '<span class="priority-contact" title="Priority contact">🕎</span>' : '';
    const roleMark = member.role === 'shepherd' ? '<span class="role-chip">Shepherd</span>' : '';
    const rosterChip = lifecycle !== 'current' ? `<span class="priority ${ministryStatusClass(lifecycle)} roster-chip">${ministryStatusLabel(lifecycle)}</span>` : '';
    return `<tr data-status="${memberMetrics.status}">
      <td><div class="table-person"><span class="member-avatar">${initials(member.name)}</span><div><strong>${priorityMark}${escapeHTML(member.name)} ${roleMark}</strong><small>${rosterChip || `Joined ${formatDate(member.joinedDate, { month: 'short', year: 'numeric' })}`}</small></div></div></td>
      <td>${escapeHTML(member.phone || '—')}</td>
      <td>${formatDate(member.dob, { day: 'numeric', month: 'short' })}</td>
      <td>${member.role === 'shepherd' && lifecycle === 'current' ? '<span class="muted-text">Shepherd</span>' : shepherd ? escapeHTML(shepherd.name) : '<span class="unassigned-text">Unassigned</span>'}</td>
      <td><strong>${memberMetrics.opportunities ? `${memberMetrics.rate}%` : '—'}</strong><small class="table-subtext">${memberMetrics.presentCount}/${memberMetrics.opportunities} Sundays</small></td>
      <td>${lifecycle === 'current' ? `<span class="classification-pill ${classificationClass(memberMetrics.classificationZone)}">${classificationLabel(memberMetrics.classificationZone)}</span>` : `<span class="priority ${ministryStatusClass(lifecycle)}">${ministryStatusLabel(lifecycle)}</span>`}</td>
      <td><div class="table-action-row"><button class="row-action" data-member-view="${member.id}">View</button><button class="row-action subtle-action" data-edit-member="${member.id}">Edit</button></div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7"><div class="empty-state">No members match the current filters.</div></td></tr>';
}


function renderClassification() {
  const all = getClassificationMembers();
  const counts = zone => all.filter(item => item.classification.zone === zone).length;
  const needsAttention = counts('green') + counts('red');
  const stats = document.getElementById('classificationStats');
  if (stats) stats.innerHTML = [
    statCard('Active', counts('active'), 'Attendance currently stable', '✓'),
    statCard('Needs Help — Green', counts('green'), 'Two consecutive Sunday or Thursday misses', '♡', 'classification-stat-green'),
    statCard('Urgent Contact — Red', counts('red'), 'Five consecutive misses: contact immediately', '!', 'classification-stat-red'),
    statCard('Unclassified', counts('unclassified'), 'Needs attendance history or admin review', '○')
  ].join('');

  const alerts = all.filter(item => ['green','red'].includes(item.classification.zone));
  const alertHtml = alerts.length
    ? `<div class="admin-alert-icon">!</div><div><strong>Admin attention: ${alerts.length} member${alerts.length === 1 ? '' : 's'} need follow-up.</strong><p>${counts('red')} urgent red • ${counts('green')} needs-help green. Open the list below and contact the responsible shepherd.</p></div>`
    : `<div class="admin-alert-icon stable">✓</div><div><strong>No attendance-based member alerts.</strong><p>No current member has reached the two-miss threshold.</p></div>`;
  const pageAlert = document.getElementById('classificationAdminAlert');
  const dashAlert = document.getElementById('dashboardClassificationAlert');
  if (pageAlert) { pageAlert.innerHTML = alertHtml; pageAlert.classList.toggle('has-alerts', alerts.length > 0); }
  if (dashAlert) { dashAlert.innerHTML = alertHtml; dashAlert.classList.toggle('has-alerts', alerts.length > 0); }
  const badge = document.getElementById('classificationNavBadge');
  if (badge) badge.textContent = needsAttention;

  const query = (document.getElementById('classificationSearch')?.value || '').trim().toLowerCase();
  const zoneFilter = document.getElementById('classificationZoneFilter')?.value || 'all';
  const filtered = all.filter(({member,classification}) => {
    const shepherd = getMemberShepherd(member);
    const haystack = `${member.name} ${shepherd?.name || ''} ${classification.reason} ${classification.adminMessage}`.toLowerCase();
    return (zoneFilter === 'all' || classification.zone === zoneFilter) && haystack.includes(query);
  });
  const body = document.getElementById('classificationTableBody');
  if (body) body.innerHTML = filtered.length ? filtered.map(({member,classification}) => {
    const shepherd = getMemberShepherd(member);
    return `<tr class="classification-row ${classificationClass(classification.zone)}">
      <td><div class="table-person"><span class="member-avatar">${initials(member.name)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.phone || 'No phone recorded')}</small></div></div></td>
      <td>${shepherd ? `<strong>${escapeHTML(shepherd.name)}</strong><br><small>${escapeHTML(shepherd.phone || 'No phone recorded')}</small>` : member.role === 'shepherd' ? 'Registered shepherd' : '<span class="muted-cell">Unassigned</span>'}</td>
      <td><strong>${classification.sundayMisses}</strong></td>
      <td><strong>${classification.thursdayMisses}</strong></td>
      <td><span class="classification-pill ${classificationClass(classification.zone)}">${classificationLabel(classification.zone)}</span><small class="classification-reason">${escapeHTML(classification.reason)}</small></td>
      <td>${classification.adminMessage ? `<span class="admin-message">${escapeHTML(classification.adminMessage)}</span>` : '<span class="muted-cell">No alert</span>'}</td>
      <td><div class="table-action-row"><button class="row-action" data-member-view="${member.id}">Profile</button><button class="row-action subtle-action" data-edit-member="${member.id}">Edit</button></div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="7"><div class="empty-state">No members match this classification filter.</div></td></tr>';
}

function exportClassificationCsv() {
  const rows = [['Member Name','Phone','Shepherd','Sunday Consecutive Misses','Thursday Consecutive Misses','Classification','Reason','Admin Message']];
  getClassificationMembers().forEach(({member,classification}) => {
    const shepherd = getMemberShepherd(member);
    rows.push([member.name, member.phone || '', shepherd?.name || '', classification.sundayMisses, classification.thursdayMisses, classificationLabel(classification.zone), classification.reason, classification.adminMessage]);
  });
  const csv = rows.map(row => row.map(csvEscape).join(',')).join('\n');
  downloadFile('faithful-city-member-classification.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
}

function renderVisitors() {
  const periodVisitors = state.visitors.filter(visitorMatchesPeriod);
  const activeVisitors = periodVisitors.filter(visitor => (visitor.visitorStatus || 'active') === 'active');
  const repeatVisitors = activeVisitors.filter(visitor => (visitor.visits || 0) >= 2).length;
  const recentVisitors = activeVisitors.filter(visitor => visitor.lastVisit && visitor.lastVisit >= new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)).length;
  const archivedVisitors = periodVisitors.length - activeVisitors.length;

  const stats = document.getElementById('visitorStats');
  if (stats) stats.innerHTML = [
    statCard('Current Visitors', activeVisitors.length, 'Separate from member roll', '+'),
    statCard('Repeat Visitors', repeatVisitors, 'Two or more recorded visits', '↻'),
    statCard('Visited in 30 Days', recentVisitors, 'Recently connected guests', '✓'),
    statCard('Archived Visitors', archivedVisitors, 'Hidden from active visitor list', '◷')
  ].join('');

  const body = document.getElementById('visitorsTableBody');
  if (!body) return;
  const query = (document.getElementById('visitorSearch')?.value || '').trim().toLowerCase();
  const registryFilter = document.getElementById('visitorRegistryFilter')?.value || 'active';
  const filtered = state.visitors.filter(visitor => visitorMatchesPeriod(visitor)).filter(visitor => {
    const status = visitor.visitorStatus || 'active';
    return (registryFilter === 'all' || status === registryFilter) && `${visitor.name} ${visitor.phone || ''} ${visitor.invitedByName || ''}`.toLowerCase().includes(query);
  }).sort((a, b) => (b.lastVisit || '').localeCompare(a.lastVisit || '') || a.name.localeCompare(b.name));

  body.innerHTML = filtered.length ? filtered.map(visitor => {
    const status = visitor.visitorStatus || 'active';
    return `<tr>
      <td><div class="table-person"><span class="member-avatar visitor-avatar">${initials(visitor.name)}</span><div><strong>${escapeHTML(visitor.name)}</strong><small>Visitor / guest</small></div></div></td>
      <td>${escapeHTML(visitor.phone || '—')}</td>
      <td><strong>${escapeHTML(visitor.invitedByName || 'Not recorded')}</strong></td>
      <td>${escapeHTML(semesterFullLabel(getVisitorSemester(visitor)))}</td>
      <td>${formatDate(visitor.dob, { day: 'numeric', month: 'short' })}</td>
      <td>${formatDate(visitor.firstVisit)}</td>
      <td>${formatDate(visitor.lastVisit)}</td>
      <td><strong>${visitor.visits || 0}</strong></td>
      <td><span class="priority ${status === 'active' ? 'new-status' : 'archived-status'}">${status === 'active' ? 'Visitor' : 'Archived'}</span></td>
      <td><div class="table-action-row">${status === 'active' ? `<button class="row-action" data-convert-visitor="${visitor.id}">Make member</button><button class="row-action subtle-action" data-archive-visitor="${visitor.id}">Archive</button>` : `<button class="row-action" data-restore-visitor="${visitor.id}">Restore</button>`}<button class="row-action danger-action" data-delete-visitor="${visitor.id}">Delete</button></div></td>
    </tr>`;
  }).join('') : '<tr><td colspan="10"><div class="empty-state">No visitors match the current filters or selected semester/year.</div></td></tr>';
}

function renderShepherds() {
  const shepherds = getShepherds();
  const assigned = getCurrentMembers().filter(member => member.role !== 'shepherd' && member.shepherdId).length;
  const unassigned = getCurrentMembers().filter(member => member.role !== 'shepherd' && !member.shepherdId).length;
  const irregularAssigned = getCurrentMembers().filter(member => member.shepherdId && getMemberMetrics(member).status === 'inactive').length;

  document.getElementById('shepherdStats').innerHTML = [
    statCard('Registered Shepherds', shepherds.length, 'Selected from church members', '♧'),
    statCard('Assigned Members', assigned, 'Members with a responsible shepherd', '✓'),
    statCard('Unassigned Members', unassigned, 'Needs shepherd assignment', '○'),
    statCard('Inactive in Groups', irregularAssigned, 'Ask the responsible shepherd first', '♡')
  ].join('');

  document.getElementById('shepherdGrid').innerHTML = shepherds.length ? shepherds.map(shepherd => {
    const flock = state.members.filter(member => member.shepherdId === shepherd.id).sort((a, b) => a.name.localeCompare(b.name));
    const inactive = flock.filter(member => getMemberMetrics(member).status === 'inactive');
    const high = flock.filter(member => getMemberMetrics(member).carePriority === 'high');
    return `<article class="shepherd-card">
      <div class="shepherd-card-head">
        <div class="table-person"><span class="member-avatar large">${initials(shepherd.name)}</span><div><span class="eyebrow">Shepherd</span><h4>${escapeHTML(shepherd.name)}</h4><small>${escapeHTML(shepherd.phone || 'No phone recorded')}</small></div></div>
        <button class="row-action" data-member-view="${shepherd.id}">Profile</button>
      </div>
      <div class="shepherd-card-metrics"><span><strong>${flock.length}</strong> assigned</span><span><strong>${inactive.length}</strong> inactive</span><span><strong>${high.length}</strong> high priority</span></div>
      <div class="mini-flock-list">
        ${flock.length ? flock.slice(0, 5).map(member => {
          const memberMetrics = getMemberMetrics(member);
          return `<button data-member-view="${member.id}"><span>${escapeHTML(member.name)}</span><span class="priority ${statusClass(memberMetrics.status)}">${statusLabel(memberMetrics.status)}</span></button>`;
        }).join('') : '<div class="empty-mini">No members assigned yet.</div>'}
      </div>
      <div class="shepherd-card-footer">
        <button class="btn btn-soft" data-shepherd-open="${shepherd.id}">View full group</button>
        <button class="btn btn-dark" data-assign-shepherd="${shepherd.id}">Assign member</button>
      </div>
    </article>`;
  }).join('') : '<article class="panel empty-state">No shepherds have been registered. Choose a current member and designate them as a shepherd.</article>';
}

function renderFilterOptions() {
  renderPeriodFilters();
  const shepherds = getShepherds();
  const memberSelect = document.getElementById('memberShepherdFilter');
  const attendanceSelect = document.getElementById('attendanceShepherdFilter');
  const options = shepherds.map(shepherd => `<option value="${shepherd.id}">${escapeHTML(shepherd.name)}</option>`).join('');

  if (memberSelect) {
    const current = memberSelect.value || 'all';
    memberSelect.innerHTML = `<option value="all">All shepherds</option><option value="unassigned">Unassigned</option>${options}`;
    memberSelect.value = [...memberSelect.options].some(option => option.value === current) ? current : 'all';
  }
  if (attendanceSelect) {
    const current = attendanceSelect.value || 'all';
    attendanceSelect.innerHTML = `<option value="all">All shepherd groups</option><option value="unassigned">Unassigned</option>${options}`;
    attendanceSelect.value = [...attendanceSelect.options].some(option => option.value === current) ? current : 'all';
  }

  const programSelect = document.getElementById('serviceSelect');
  if (programSelect) {
    const current = programSelect.value || 'program_sunday';
    const activePrograms = getActivePrograms();
    const builtIns = activePrograms.filter(program => program.type !== 'special');
    const specials = activePrograms.filter(program => program.type === 'special');
    programSelect.innerHTML = `
      <optgroup label="Regular gatherings">
        ${builtIns.map(program => `<option value="${program.id}">${escapeHTML(program.name)}</option>`).join('')}
      </optgroup>
      ${specials.length ? `<optgroup label="Special semester programs">${specials.map(program => `<option value="${program.id}">${escapeHTML(program.name)}</option>`).join('')}</optgroup>` : ''}
    `;
    programSelect.value = [...programSelect.options].some(option => option.value === current)
      ? current
      : (programSelect.querySelector('option')?.value || 'program_sunday');
  }

  const historyServiceFilter = document.getElementById('historyServiceFilter');
  if (historyServiceFilter) {
    const current = historyServiceFilter.value || 'all';
    const programsWithRecords = state.programs
      .filter(program => state.services.some(record => record.programId === program.id || record.service === program.name))
      .sort((a, b) => a.name.localeCompare(b.name));
    historyServiceFilter.innerHTML = `<option value="all">All services & programs</option>${programsWithRecords.map(program => `<option value="${program.id}">${escapeHTML(program.name)}</option>`).join('')}`;
    historyServiceFilter.value = [...historyServiceFilter.options].some(option => option.value === current) ? current : 'all';
  }
}


function renderPeriodFilters() {
  const yearSelect = document.getElementById('periodAcademicYearFilter');
  const calendarSelect = document.getElementById('periodCalendarYearFilter');
  const semesterSelect = document.getElementById('periodSemesterFilter');
  if (!yearSelect || !calendarSelect || !semesterSelect) return;

  const years = [...new Set((state.semesters || []).map(item => item.academicYear).filter(Boolean))].sort().reverse();
  const calendarYears = [...new Set([...(state.semesters || []).map(item => item.calendarYear).filter(Boolean), ...state.services.map(item => item.date?.slice(0,4)).filter(Boolean)])].sort().reverse();
  yearSelect.innerHTML = `<option value="all">All academic years</option>${years.map(year => `<option value="${escapeHTML(year)}">${escapeHTML(year)}</option>`).join('')}`;
  calendarSelect.innerHTML = `<option value="all">All calendar years</option>${calendarYears.map(year => `<option value="${escapeHTML(year)}">${escapeHTML(year)}</option>`).join('')}`;
  const semesterPool = (state.semesters || []).filter(item => periodFilter.academicYear === 'all' || item.academicYear === periodFilter.academicYear);
  semesterSelect.innerHTML = `<option value="all">All semesters</option>${semesterPool.map(semester => `<option value="${semester.id}">${escapeHTML(semesterFullLabel(semester))}</option>`).join('')}`;

  yearSelect.value = [...yearSelect.options].some(option => option.value === periodFilter.academicYear) ? periodFilter.academicYear : 'all';
  calendarSelect.value = [...calendarSelect.options].some(option => option.value === periodFilter.calendarYear) ? periodFilter.calendarYear : 'all';
  semesterSelect.value = [...semesterSelect.options].some(option => option.value === periodFilter.semesterId) ? periodFilter.semesterId : 'all';
  periodFilter.academicYear = yearSelect.value;
  periodFilter.calendarYear = calendarSelect.value;
  periodFilter.semesterId = semesterSelect.value;

  const current = getCurrentSemester();
  const summary = document.getElementById('currentPeriodSummary');
  if (summary) summary.textContent = current ? `Member classification uses consecutive Sunday and Thursday attendance in ${semesterFullLabel(current)}.` : 'No current semester selected.';
  const mobilePeriodLabel = document.getElementById('mobilePeriodLabel');
  if (mobilePeriodLabel) {
    const selectedSemester = periodFilter.semesterId !== 'all' ? getSemester(periodFilter.semesterId) : null;
    mobilePeriodLabel.textContent = selectedSemester ? semesterFullLabel(selectedSemester) : (current ? semesterFullLabel(current) : 'All periods');
  }
}

function updatePeriodFilterFromControls() {
  periodFilter.academicYear = document.getElementById('periodAcademicYearFilter')?.value || 'all';
  periodFilter.calendarYear = document.getElementById('periodCalendarYearFilter')?.value || 'all';
  periodFilter.semesterId = document.getElementById('periodSemesterFilter')?.value || 'all';
  renderAll();
}

function currentAttendanceKey() {
  const programId = document.getElementById('serviceSelect')?.value || 'program_sunday';
  const program = getProgram(programId) || getProgram('program_sunday');
  const date = document.getElementById('attendanceDate')?.value || isoToday();
  const semester = getSemesterForDate(date) || getProgramSemester(program);
  return {
    date,
    programId: program?.id || programId,
    service: program?.name || 'Sunday Service',
    eventType: program?.type || 'sunday',
    semesterId: semester?.id || '',
    academicYear: semester?.academicYear || '',
    calendarYear: String(date).slice(0, 4)
  };
}

function setAttendanceMetaFields(meta = {}) {
  const topic = document.getElementById('eventTopic');
  const minister = document.getElementById('eventMinister');
  const scripture = document.getElementById('eventScripture');
  const notes = document.getElementById('eventNotes');
  if (topic) topic.value = meta.topic || '';
  if (minister) minister.value = meta.minister || '';
  if (scripture) scripture.value = meta.scripture || '';
  if (notes) notes.value = meta.notes || '';
}

function syncAttendanceDraftMetaFromFields() {
  attendanceDraft.meta = {
    topic: String(document.getElementById('eventTopic')?.value || '').trim(),
    minister: String(document.getElementById('eventMinister')?.value || '').trim(),
    scripture: String(document.getElementById('eventScripture')?.value || '').trim(),
    notes: String(document.getElementById('eventNotes')?.value || '').trim()
  };
}

function loadAttendanceDraft() {
  const { date, programId, service } = currentAttendanceKey();
  const existing = state.services.find(record => record.date === date && (record.programId === programId || (!record.programId && record.service === service)));
  attendanceDraft = {
    presentMemberIds: new Set((existing?.presentMemberIds || []).filter(id => { const member = getMember(id); return member && isMemberEligibleOnDate(member, date); })),
    visitorIds: new Set((existing?.visitorIds || []).filter(id => { const visitor = getVisitor(id); return visitor && (visitor.visitorStatus || 'active') === 'active'; })),
    meta: {
      topic: existing?.topic || '',
      minister: existing?.minister || '',
      scripture: existing?.scripture || '',
      notes: existing?.notes || ''
    }
  };
  setAttendanceMetaFields(attendanceDraft.meta);
  renderAttendance();
}

function renderAttendance() {
  const register = document.getElementById('attendanceRegister');
  if (!register) return;
  const query = (document.getElementById('attendanceSearch')?.value || '').trim().toLowerCase();
  const shepherdFilter = document.getElementById('attendanceShepherdFilter')?.value || 'all';

  const { date: attendanceDate } = currentAttendanceKey();
  const filtered = state.members.filter(member => {
    if (!isMemberEligibleOnDate(member, attendanceDate)) return false;
    const shepherd = getMemberShepherd(member);
    const haystack = `${member.name} ${member.phone} ${shepherd?.name || ''}`.toLowerCase();
    const shepherdMatch = shepherdFilter === 'all' || (shepherdFilter === 'unassigned' ? !member.shepherdId && member.role !== 'shepherd' : member.shepherdId === shepherdFilter || member.id === shepherdFilter);
    return haystack.includes(query) && shepherdMatch;
  }).sort((a, b) => Number(b.priorityContact) - Number(a.priorityContact) || a.name.localeCompare(b.name));

  register.innerHTML = filtered.length ? filtered.map(member => {
    const metrics = getMemberMetrics(member);
    const shepherd = getMemberShepherd(member);
    const checked = attendanceDraft.presentMemberIds.has(member.id);
    return `<label class="attendance-row" data-member-id="${member.id}" data-name="${escapeHTML(member.name.toLowerCase())}">
      <input type="checkbox" ${checked ? 'checked' : ''} data-attendance-member="${member.id}">
      <span class="custom-check"></span>
      <span class="member-avatar">${initials(member.name)}</span>
      <span class="attendance-name"><strong>${member.priorityContact ? '🕎 ' : ''}${escapeHTML(member.name)}</strong><small>${shepherd ? `Shepherd: ${escapeHTML(shepherd.name)}` : member.role === 'shepherd' ? 'Registered shepherd' : 'No shepherd assigned'} • ${statusLabel(metrics.status)}</small></span>
      <span class="attendance-status">${checked ? 'Present' : 'Absent'}</span>
    </label>`;
  }).join('') : '<div class="empty-state">No registered members match this search or group filter.</div>';

  const visitorContainer = document.getElementById('todayVisitors');
  const selectedVisitors = [...attendanceDraft.visitorIds].map(getVisitor).filter(Boolean);
  visitorContainer.innerHTML = selectedVisitors.length ? selectedVisitors.map(visitor => `<div class="visitor-row">
    <span class="member-avatar visitor-avatar">${initials(visitor.name)}</span>
    <div><strong>${escapeHTML(visitor.name)}</strong><small>${escapeHTML(visitor.phone || 'No phone')} • Invited by ${escapeHTML(visitor.invitedByName || 'not recorded')} • Birthday ${formatDate(visitor.dob, { day: 'numeric', month: 'short' })}</small></div>
    <span class="priority new-status">Visitor</span>
    <button class="row-action" data-convert-visitor="${visitor.id}">Make member</button>
    <button class="icon-text-btn" data-remove-today-visitor="${visitor.id}" title="Remove from today">×</button>
  </div>`).join('') : '<div class="empty-state small-empty">No visitors or newly registered attendees added to this service yet.</div>';

  renderAttendanceEventContext();
  updateAttendanceCounts();
}

function renderAttendanceEventContext() {
  const context = document.getElementById('attendanceEventContext');
  if (!context) return;
  const { programId, semesterId, academicYear, calendarYear } = currentAttendanceKey();
  const program = getProgram(programId);
  if (!program) {
    context.innerHTML = '';
    return;
  }
  const scheduleText = program.type === 'sunday'
    ? 'Main church service • normally Sunday'
    : program.type === 'midweek'
      ? 'Midweek gathering • normally Thursday'
      : [
          program.semester,
          program.startDate ? `${formatDate(program.startDate)}${program.endDate && program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ''}` : '',
          program.venue
        ].filter(Boolean).join(' • ');

  const semester = getSemester(semesterId);
  context.innerHTML = `<div class="event-context-card ${program.type}">
    <div>
      <span class="event-type-pill">${programTypeLabel(program.type)}</span>
      <h4>${escapeHTML(program.name)}</h4>
      <p>${escapeHTML(scheduleText || 'Custom church program')}</p><small class="period-line">${escapeHTML(semesterFullLabel(semester))} • Calendar year ${escapeHTML(calendarYear || '—')}</small>
    </div>
    ${program.theme ? `<div class="event-context-theme"><span>Program theme</span><strong>${escapeHTML(program.theme)}</strong></div>` : ''}
    ${program.type === 'special' ? `<button class="btn btn-soft compact-btn" data-program-open="${program.id}">Program details</button>` : ''}
  </div>`;
}

function updateAttendanceCounts() {
  const present = attendanceDraft.presentMemberIds.size;
  const { date } = currentAttendanceKey();
  const eligibleCount = state.members.filter(member => isMemberEligibleOnDate(member, date)).length;
  const absent = Math.max(0, eligibleCount - present);
  const visitors = attendanceDraft.visitorIds.size;
  const total = present + visitors;
  document.getElementById('presentCount').textContent = present;
  document.getElementById('absentCount').textContent = absent;
  document.getElementById('visitorCount').textContent = visitors;
  document.getElementById('totalAttendanceCount').textContent = total;
}

function saveAttendanceRecord() {
  const beforeClassification = Object.fromEntries(getCurrentMembers().map(member => [member.id, getMemberClassification(member).zone]));
  const { date, programId, service, eventType, semesterId, academicYear, calendarYear } = currentAttendanceKey();
  if (!date || !programId) return showToast('Please choose a date and service or program.');

  syncAttendanceDraftMetaFromFields();

  let record = state.services.find(item => item.date === date && (item.programId === programId || (!item.programId && item.service === service)));
  if (!record) {
    record = { id: uid('service'), date, programId, service, eventType, semesterId, academicYear, calendarYear, presentMemberIds: [], visitorIds: [], topic: '', minister: '', scripture: '', notes: '' };
    state.services.push(record);
  }
  record.programId = programId;
  record.service = service;
  record.eventType = eventType;
  record.semesterId = semesterId;
  record.academicYear = academicYear;
  record.calendarYear = calendarYear;
  record.presentMemberIds = [...attendanceDraft.presentMemberIds];
  record.visitorIds = [...attendanceDraft.visitorIds];
  record.topic = attendanceDraft.meta.topic;
  record.minister = attendanceDraft.meta.minister;
  record.scripture = attendanceDraft.meta.scripture;
  record.notes = attendanceDraft.meta.notes;
  record.updatedAt = new Date().toISOString();

  record.visitorIds.forEach(id => {
    const visitor = getVisitor(id);
    if (!visitor) return;
    const serviceDates = state.services.filter(serviceRecord => serviceRecord.visitorIds?.includes(id)).map(serviceRecord => serviceRecord.date).filter(Boolean);
    const visitDates = [...new Set([...(visitor.sourceVisitDates || []), ...serviceDates])].sort();
    visitor.visits = visitDates.length;
    visitor.firstVisit = visitDates[0] || visitor.firstVisit || date;
    visitor.lastVisit = visitDates[visitDates.length - 1] || date;
    visitor.firstVisitSemesterId = visitor.firstVisitSemesterId || getSemesterForDate(visitor.firstVisit)?.id || semesterId;
  });

  saveState();
  renderAll();
  const stats = getRecordStats(record);
  const topicText = record.topic ? ` • Topic: ${record.topic}` : '';
  const escalated = getCurrentMembers().map(member => ({ member, now: getMemberClassification(member), before: beforeClassification[member.id] }))
    .filter(item => ['green','red'].includes(item.now.zone) && item.now.zone !== item.before);
  const alertText = escalated.length ? ` ADMIN ALERT: ${escalated.length} member${escalated.length === 1 ? '' : 's'} moved to a follow-up zone. Open Members Classification.` : '';
  showToast(`Saved ${service}: ${stats.present} members + ${stats.visitors} visitors = ${stats.total} total${topicText}.${alertText}`);
}


function renderPrograms() {
  const statsContainer = document.getElementById('programStats');
  const regularContainer = document.getElementById('regularProgramCards');
  const specialContainer = document.getElementById('specialProgramList');
  const ministryLog = document.getElementById('ministryLog');
  if (!statsContainer || !regularContainer || !specialContainer || !ministryLog) return;

  const specialPrograms = getSpecialPrograms().filter(programMatchesPeriod);
  const activeSpecials = specialPrograms.filter(program => program.active !== false);
  const scopedServices = getPeriodServices();
  const topicCount = scopedServices.filter(record => record.topic).length;
  const specialAttendanceRecords = scopedServices.filter(record => getProgramForRecord(record)?.type === 'special');
  const upcomingPrograms = getUpcomingSpecialPrograms(120);

  statsContainer.innerHTML = [
    statCard('Regular Gatherings', state.programs.filter(program => program.type !== 'special' && program.active !== false).length, 'Sunday main service + Thursday midweek', '◷'),
    statCard('Active Special Programs', activeSpecials.length, `${specialPrograms.length} total special-program record${specialPrograms.length === 1 ? '' : 's'}`, '✦'),
    statCard('Events With Topics', topicCount, `${scopedServices.length} attendance event${scopedServices.length === 1 ? '' : 's'} in selected period`, '▤'),
    statCard('Upcoming Programs', upcomingPrograms.length, `${upcomingPrograms.filter(program => program.reminderEnabled).length} reminder${upcomingPrograms.filter(program => program.reminderEnabled).length === 1 ? '' : 's'} set`, '⏰')
  ].join('');

  updateProgramReminderUI();

  const regularPrograms = state.programs.filter(program => program.type !== 'special');
  regularContainer.innerHTML = regularPrograms.map(program => {
    const records = getProgramRecords(program.id);
    const latest = records[0];
    const schedule = program.type === 'sunday' ? 'Normally Sundays' : 'Normally Thursdays';
    return `<article class="program-card regular-program-card ${program.type}">
      <div class="program-card-top">
        <span class="event-type-pill">${programTypeLabel(program.type)}</span>
        <span class="priority ${program.countsForActivity ? 'watch' : 'new-status'}">${program.countsForActivity ? 'Activity classification' : 'Tracked separately'}</span>
      </div>
      <h4>${escapeHTML(program.name)}</h4>
      <p>${escapeHTML(program.notes || schedule)}</p>
      <div class="program-facts">
        <span><strong>${schedule}</strong><small>Usual schedule</small></span>
        <span><strong>${records.length}</strong><small>Attendance records</small></span>
        <span><strong>${latest ? formatDate(latest.date) : 'None yet'}</strong><small>Latest record</small></span>
      </div>
      <button class="btn btn-soft full-width" data-program-open="${program.id}">View ministry & attendance log</button>
    </article>`;
  }).join('');

  specialContainer.innerHTML = specialPrograms.length ? specialPrograms.map(program => {
    const records = getProgramRecords(program.id);
    const totalAttendance = records.reduce((sum, record) => sum + getRecordStats(record).total, 0);
    const dateText = program.startDate
      ? `${formatDate(program.startDate)}${program.endDate && program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ''}`
      : 'Dates not set';
    return `<article class="special-program-card ${program.active === false ? 'archived-program' : ''}">
      <div class="special-program-header">
        <div>
          <span class="event-type-pill">Special program</span>
          <h4>${escapeHTML(program.name)}</h4>
          <p>${escapeHTML([program.semester, dateText, program.venue].filter(Boolean).join(' • '))}</p>
        </div>
        <span class="priority ${program.active === false ? 'archived-status' : 'watch'}">${program.active === false ? 'Archived' : 'Active'}</span>
      </div>
      ${program.theme ? `<div class="program-theme"><span>Theme</span><strong>${escapeHTML(program.theme)}</strong></div>` : ''}
      <p class="program-description">${escapeHTML(program.notes || 'No additional notes recorded yet.')}</p>
      <div class="program-card-reminder ${program.reminderEnabled ? 'reminder-enabled' : ''}">
        <span>${program.reminderEnabled ? '⏰' : '○'}</span>
        <div><strong>${program.reminderEnabled ? escapeHTML(formatReminderDateTime(program)) : 'No reminder set'}</strong><small>${program.reminderMessage ? escapeHTML(program.reminderMessage) : 'Add a reminder date, time and message for leaders.'}</small></div>
      </div>
      <div class="program-facts compact-program-facts">
        <span><strong>${records.length}</strong><small>Attendance days</small></span>
        <span><strong>${totalAttendance}</strong><small>Cumulative attendance</small></span>
        <span><strong>${records.filter(record => record.topic).length}</strong><small>Topics recorded</small></span>
      </div>
      <div class="button-row program-actions">
        <button class="btn btn-soft" data-program-open="${program.id}">Open</button>
        <button class="btn btn-soft" data-program-edit="${program.id}">${program.reminderEnabled ? 'Edit / reminder' : 'Set reminder'}</button>
        <button class="btn btn-soft ${program.active === false ? '' : 'danger-outline'}" data-program-toggle="${program.id}">${program.active === false ? 'Restore' : 'Archive'}</button>
      </div>
    </article>`;
  }).join('') : '<article class="panel empty-state">No special semester programs yet. Create one to track its name, theme, dates, venue, notes, daily topics, ministers and attendance.</article>';

  const recordsWithMinistry = [...getPeriodServices()]
    .filter(record => record.topic || record.minister || record.scripture)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12);

  ministryLog.innerHTML = recordsWithMinistry.length ? recordsWithMinistry.map(record => {
    const program = getProgramForRecord(record);
    return `<button class="ministry-log-item" data-history-open="${record.id}">
      <div class="ministry-log-date"><strong>${formatDate(record.date, { day: 'numeric', month: 'short' })}</strong><span>${programTypeShortLabel(program?.type || record.eventType)}</span></div>
      <div class="ministry-log-copy">
        <strong>${escapeHTML(record.topic || 'Topic not recorded')}</strong>
        <span>${escapeHTML(record.service)}${record.minister ? ` • Minister: ${escapeHTML(record.minister)}` : ''}${record.scripture ? ` • ${escapeHTML(record.scripture)}` : ''}</span>
      </div>
      <span class="row-action">Open</span>
    </button>`;
  }).join('') : '<div class="empty-state">No ministry topics have been recorded yet.</div>';
}

function openSpecialProgramForm(programId = null) {
  const existing = programId ? getProgram(programId) : null;
  if (existing?.fixed) return showToast('Sunday and Thursday are fixed regular gatherings. Their daily topics are recorded when taking attendance.');

  openModal({
    eyebrow: existing ? 'Edit semester program' : 'New semester program',
    title: existing ? `Edit ${existing.name}` : 'Create a special program',
    subtitle: 'Create the program once, then record separate attendance, topic, minister and notes for every day it meets.',
    wide: true,
    body: `<form class="lux-form" id="specialProgramForm">
      <div class="form-grid two-col">
        <label><span>Program name *</span><input name="name" required value="${escapeHTML(existing?.name || '')}" placeholder="e.g. Freshers Welcome Service"></label>
        <label><span>Semester / academic period *</span><select name="semesterId" required>${semesterOptions(existing?.semesterId || state.settings.currentSemesterId)}</select></label>
        <label><span>Start date</span><input type="date" name="startDate" value="${escapeHTML(existing?.startDate || '')}"></label>
        <label><span>End date</span><input type="date" name="endDate" value="${escapeHTML(existing?.endDate || '')}"></label>
        <label><span>Program theme</span><input name="theme" value="${escapeHTML(existing?.theme || '')}" placeholder="e.g. Rooted and Built Up"></label>
        <label><span>Venue</span><input name="venue" value="${escapeHTML(existing?.venue || '')}" placeholder="e.g. KNUST Great Hall"></label>
        <label><span>Organizer / department</span><input name="organizer" value="${escapeHTML(existing?.organizer || '')}" placeholder="e.g. Evangelism Team"></label>
        <label><span>Status</span><select name="active"><option value="true" ${existing?.active !== false ? 'selected' : ''}>Active</option><option value="false" ${existing?.active === false ? 'selected' : ''}>Archived</option></select></label>
      </div>
      <fieldset class="reminder-fieldset">
        <legend>Upcoming-program reminder</legend>
        <div class="form-grid two-col">
          <label><span>Reminder status</span><select name="reminderEnabled"><option value="false" ${existing?.reminderEnabled ? '' : 'selected'}>No reminder</option><option value="true" ${existing?.reminderEnabled ? 'selected' : ''}>Enable reminder</option></select></label>
          <label><span>Reminder date</span><input type="date" name="reminderDate" value="${escapeHTML(existing?.reminderDate || '')}"></label>
          <label><span>Reminder time</span><input type="time" name="reminderTime" value="${escapeHTML(existing?.reminderTime || '09:00')}"></label>
          <label><span>Reminder message</span><input name="reminderMessage" value="${escapeHTML(existing?.reminderMessage || '')}" placeholder="e.g. Remind members and complete logistics today."></label>
        </div>
        <p class="form-help">The reminder will appear in ChurchCare. Browser alerts can also appear while the website is open after permission is granted.</p>
      </fieldset>
      <label><span>Program notes / purpose</span><textarea name="notes" rows="4" placeholder="Record the purpose, target audience, logistics or other useful information.">${escapeHTML(existing?.notes || '')}</textarea></label>
      <div class="form-help">For a multi-day program, choose the same program on the Take Attendance page and change only the date. Each day gets its own attendance, topic ministered, minister/speaker, scripture and notes.</div>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">${existing ? 'Save program changes' : 'Create special program'}</button></div>
    </form>`,
    onOpen: () => {
      document.getElementById('specialProgramForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const startDate = String(data.get('startDate') || '');
        const endDate = String(data.get('endDate') || '');
        if (startDate && endDate && endDate < startDate) return showToast('End date cannot be earlier than the start date.');

        const reminderEnabled = String(data.get('reminderEnabled')) === 'true';
        const reminderDate = String(data.get('reminderDate') || '');
        const reminderTime = String(data.get('reminderTime') || '09:00');
        if (reminderEnabled && !reminderDate) return showToast('Choose a reminder date or turn the reminder off.');
        if (reminderEnabled && startDate && reminderDate > startDate) return showToast('The reminder should be on or before the program start date.');

        const name = String(data.get('name') || '').trim();
        const duplicate = state.programs.find(program => program.id !== existing?.id && program.name.toLowerCase() === name.toLowerCase());
        if (duplicate) return showToast('A program with that name already exists.');

        const values = {
          name,
          type: 'special',
          recurring: false,
          defaultDay: null,
          countsForActivity: false,
          active: String(data.get('active')) !== 'false',
          fixed: false,
          semesterId: String(data.get('semesterId') || ''),
          semester: semesterFullLabel(getSemester(String(data.get('semesterId') || ''))),
          startDate,
          endDate,
          theme: String(data.get('theme') || '').trim(),
          venue: String(data.get('venue') || '').trim(),
          organizer: String(data.get('organizer') || '').trim(),
          notes: String(data.get('notes') || '').trim(),
          reminderEnabled,
          reminderDate,
          reminderTime,
          reminderMessage: String(data.get('reminderMessage') || '').trim()
        };

        if (existing) Object.assign(existing, values);
        else state.programs.push({ id: uid('program'), ...values });

        saveState();
        closeModal();
        renderFilterOptions();
        renderAll();
        showToast(existing ? 'Special program updated.' : 'Special program created. It is now available in Take Attendance.');
      });
    }
  });
}

function toggleProgramArchive(programId) {
  const program = getProgram(programId);
  if (!program || program.fixed) return;
  program.active = program.active === false;
  saveState();
  renderFilterOptions();
  renderAll();
  showToast(program.active ? `${program.name} restored.` : `${program.name} archived. Attendance history is preserved.`);
}

function openProgramDetails(programId) {
  const program = getProgram(programId);
  if (!program) return;
  const records = getProgramRecords(program.id);
  const totalAttendance = records.reduce((sum, record) => sum + getRecordStats(record).total, 0);
  const dateText = program.type === 'sunday'
    ? 'Normally Sundays'
    : program.type === 'midweek'
      ? 'Normally Thursdays'
      : program.startDate
        ? `${formatDate(program.startDate)}${program.endDate && program.endDate !== program.startDate ? ` – ${formatDate(program.endDate)}` : ''}`
        : 'Dates not set';

  openModal({
    eyebrow: programTypeLabel(program.type),
    title: program.name,
    subtitle: [program.semester, dateText, program.venue].filter(Boolean).join(' • ') || 'Program details and attendance history',
    wide: true,
    body: `<div class="program-detail-hero">
      <div>${program.theme ? `<span>Theme</span><strong>${escapeHTML(program.theme)}</strong>` : `<span>Program purpose</span><strong>${escapeHTML(program.notes || 'No theme or description recorded')}</strong>`}</div>
      <div><span>Attendance days</span><strong>${records.length}</strong></div>
      <div><span>Cumulative attendance</span><strong>${totalAttendance}</strong></div>
    </div>
    ${program.notes && program.theme ? `<div class="care-reason-box"><strong>Program notes</strong><p>${escapeHTML(program.notes)}</p></div>` : ''}
    <div class="program-detail-reminder ${program.reminderEnabled ? 'enabled' : ''}">
      <span>${program.reminderEnabled ? '⏰' : '○'}</span>
      <div><strong>${program.reminderEnabled ? `Reminder: ${escapeHTML(formatReminderDateTime(program))}` : 'No reminder has been set'}</strong><p>${escapeHTML(program.reminderMessage || 'Edit this program to set a reminder date, time and message.')}</p></div>
    </div>
    <div class="program-detail-actions">
      <button class="btn btn-gold" data-program-attendance="${program.id}">Take attendance for this program</button>
      ${!program.fixed ? `<button class="btn btn-soft" data-program-edit="${program.id}">Edit program details</button>` : ''}
    </div>
    <div class="program-record-list">
      ${records.length ? records.map(record => {
        const stats = getRecordStats(record);
        return `<button class="program-record-row" data-history-open="${record.id}">
          <div><strong>${formatDate(record.date)}</strong><span>${escapeHTML(record.topic || 'Topic not recorded')}</span></div>
          <div><strong>${escapeHTML(record.minister || 'Minister not recorded')}</strong><span>${escapeHTML(record.scripture || 'No scripture recorded')}</span></div>
          <div><strong>${stats.total}</strong><span>Total attendance</span></div>
          <span class="row-action">Open</span>
        </button>`;
      }).join('') : '<div class="empty-state">No attendance has been recorded for this program yet.</div>'}
    </div>`
  });
}

function startAttendanceForProgram(programId) {
  const program = getProgram(programId);
  if (!program || program.active === false) return showToast('Restore this program before taking new attendance.');
  closeModal();
  switchPage('attendance');
  renderFilterOptions();
  const select = document.getElementById('serviceSelect');
  if (select) select.value = program.id;
  if (program.type === 'special' && program.startDate) {
    const dateInput = document.getElementById('attendanceDate');
    if (dateInput && !state.services.some(record => record.programId === program.id && record.date === dateInput.value)) {
      dateInput.value = program.startDate;
    }
  }
  loadAttendanceDraft();
}

function renderHistory() {
  const body = document.getElementById('historyTableBody');
  if (!body) return;
  const query = (document.getElementById('historySearch')?.value || '').trim().toLowerCase();
  const serviceFilter = document.getElementById('historyServiceFilter')?.value || 'all';
  const records = [...getPeriodServices()]
    .filter(record => {
      const semester = getRecordSemester(record);
      const haystack = `${record.date} ${record.service} ${record.topic || ''} ${record.minister || ''} ${record.scripture || ''} ${semesterFullLabel(semester)} ${semester?.academicYear || ''} ${record.calendarYear || record.date?.slice(0,4) || ''} ${formatDate(record.date)}`.toLowerCase();
      return haystack.includes(query);
    })
    .filter(record => serviceFilter === 'all' || record.programId === serviceFilter)
    .sort((a, b) => b.date.localeCompare(a.date));

  body.innerHTML = records.length ? records.map(record => {
    const stats = getRecordStats(record);
    const program = getProgramForRecord(record);
    const semester = getRecordSemester(record);
    return `<tr>
      <td><strong>${formatDate(record.date)}</strong><small class="table-subtext">${programTypeShortLabel(program?.type || record.eventType)}</small></td>
      <td><strong>${escapeHTML(semesterFullLabel(semester))}</strong><small class="table-subtext">Calendar ${escapeHTML(record.calendarYear || record.date?.slice(0,4) || '—')}</small></td>
      <td><strong>${escapeHTML(record.service)}</strong><small class="table-subline">${programTypeShortLabel(program?.type || record.eventType)}</small></td>
      <td>${record.topic ? escapeHTML(record.topic) : '<span class="muted-cell">Not recorded</span>'}</td>
      <td>${record.minister ? escapeHTML(record.minister) : '<span class="muted-cell">Not recorded</span>'}</td>
      <td>${stats.present}</td><td>${stats.absent}</td><td>${stats.visitors}</td><td><strong>${stats.total}</strong></td>
      <td><button class="row-action" data-history-open="${record.id}">Open</button></td>
    </tr>`;
  }).join('') : '<tr><td colspan="10"><div class="empty-state">No attendance records match the current filters or selected semester/year.</div></td></tr>';
}

function renderCare() {
  const careMembers = getCareMembers();
  document.getElementById('classificationRuleText').textContent = `For ${semesterFullLabel(getCurrentSemester())}: Active = at least ${state.settings.activeThreshold}% of the latest ${state.settings.windowSize} Sunday services, with fewer than ${state.settings.inactiveConsecutive} consecutive absences.`;

  document.getElementById('carePriorityGrid').innerHTML = careMembers.length ? careMembers.map(({ member, metrics }) => {
    const shepherd = getMemberShepherd(member);
    const reason = metrics.consecutiveAbsences >= state.settings.inactiveConsecutive
      ? `Missed ${metrics.consecutiveAbsences} consecutive Sunday services.`
      : metrics.status === 'inactive'
        ? `Recent Sunday attendance is ${metrics.rate}%, below the active threshold of ${state.settings.activeThreshold}%.`
        : `Recently missed a Sunday service; keep an eye on the pattern.`;
    return `<article class="care-card ${metrics.carePriority === 'high' ? 'urgent' : metrics.carePriority === 'medium' ? 'medium-card' : 'watch-card'}">
      <div class="care-card-top"><span class="member-avatar large">${initials(member.name)}</span><span class="priority ${priorityClass(metrics.carePriority)}">${priorityLabel(metrics.carePriority)}</span></div>
      <h4>${escapeHTML(member.name)}</h4>
      <p>${escapeHTML(reason)}</p>
      <div class="care-metrics"><span><strong>${metrics.rate}%</strong> Recent attendance</span><span><strong>${metrics.consecutiveAbsences}</strong> Consecutive absences</span></div>
      <div class="suggestion"><strong>Responsible shepherd</strong><span>${shepherd ? `${escapeHTML(shepherd.name)} • ${escapeHTML(shepherd.phone || 'No phone recorded')}` : 'No shepherd assigned — leadership should assign one.'}</span></div>
      <div class="button-stack">
        <button class="btn btn-dark full-width" data-member-care="${member.id}">${shepherd ? 'Ask shepherd / start follow-up' : 'Start follow-up'}</button>
        <button class="btn btn-soft full-width" data-member-view="${member.id}">View member history</button>
      </div>
    </article>`;
  }).join('') : '<article class="panel empty-state">No attendance-based care suggestions right now.</article>';
}

function getDateDayNumber(dateString) {
  return dateString ? parseISODate(dateString).getDay() : -1;
}

function isSundayAttendanceRecord(record) {
  const program = getProgramForRecord(record);
  return program?.countsForActivity === true || record.eventType === 'sunday' || record.service === 'Sunday Service';
}

function getSelectedReportSemester() {
  if (periodFilter.semesterId && periodFilter.semesterId !== 'all') return getSemester(periodFilter.semesterId);
  const matching = (state.semesters || []).filter(semester => {
    if (periodFilter.academicYear !== 'all' && semester.academicYear !== periodFilter.academicYear) return false;
    if (periodFilter.calendarYear !== 'all' && String(semester.calendarYear || '') !== String(periodFilter.calendarYear)) return false;
    return true;
  }).sort((a, b) => (b.startDate || '').localeCompare(a.startDate || ''));
  return matching.find(semester => semester.current) || matching[0] || getCurrentSemester();
}

function getSundayRecordsForSemester(semester) {
  if (!semester) return [];
  return state.services
    .filter(record => getRecordSemester(record)?.id === semester.id && isSundayAttendanceRecord(record))
    .sort((a, b) => a.date.localeCompare(b.date));
}

function getSemesterMatrixMembers(semester, sundayRecords) {
  if (!semester) return [];
  const dates = sundayRecords.map(record => record.date);
  return state.members
    .filter(member => dates.length
      ? dates.some(date => isMemberEligibleOnDate(member, date))
      : (!member.joinedDate || !semester.endDate || member.joinedDate <= semester.endDate) && (!member.statusChangedDate || !semester.startDate || member.statusChangedDate > semester.startDate))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function getSemesterMatrixData() {
  const semester = getSelectedReportSemester();
  const sundayRecords = getSundayRecordsForSemester(semester);
  const members = getSemesterMatrixMembers(semester, sundayRecords);
  return { semester, sundayRecords, members };
}

function exportSemesterMatrixCsv() {
  const { semester, sundayRecords, members } = getSemesterMatrixData();
  if (!semester) return showToast('Choose or create a semester before exporting the attendance matrix.');
  if (!sundayRecords.length) return showToast(`No Sunday attendance has been recorded for ${semesterFullLabel(semester)}.`);

  const weekHeaders = sundayRecords.map((record, index) => `Week ${index + 1} (${formatDate(record.date, { day: '2-digit', month: 'short' })})`);
  const rows = [
    ['FAITHFUL CITY DOXA PORTAL FAMILY'],
    ['Semester Sunday Attendance Matrix', semesterFullLabel(semester)],
    ['Recorded Sunday Weeks', sundayRecords.length],
    ['Generated', isoToday()],
    [],
    ['Member Name', 'Shepherd', ...weekHeaders, 'Total Present', 'Recorded Sundays', 'Attendance Percentage']
  ];

  members.forEach(member => {
    const marks = sundayRecords.map(record => !isMemberEligibleOnDate(member, record.date) ? '—' : record.presentMemberIds.includes(member.id) ? '✓' : '');
    const total = marks.filter(mark => mark === '✓').length;
    const eligibleWeeks = sundayRecords.filter(record => isMemberEligibleOnDate(member, record.date)).length;
    const percentage = eligibleWeeks ? Math.round((total / eligibleWeeks) * 100) : 0;
    rows.push([member.name, getMemberShepherd(member)?.name || (member.role === 'shepherd' ? 'Shepherd' : 'Unassigned'), ...marks, total, eligibleWeeks, `${percentage}%`]);
  });

  const safeLabel = semesterFullLabel(semester).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const csv = '\uFEFF' + rows.map(row => row.map(csvEscape).join(',')).join('\n');
  downloadFile(`faithful-city-${safeLabel}-sunday-attendance-matrix.csv`, csv, 'text/csv;charset=utf-8');
}

function renderWeekendAttendance(records) {
  const target = document.getElementById('weekendAttendanceBars');
  if (!target) return;
  const weekend = records
    .filter(record => [0, 6].includes(getDateDayNumber(record.date)))
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-14);
  const maximum = Math.max(1, ...weekend.map(record => getRecordStats(record).total));

  target.innerHTML = weekend.length ? weekend.map(record => {
    const stats = getRecordStats(record);
    const day = getDateDayNumber(record.date) === 0 ? 'Sun' : 'Sat';
    const width = Math.max(4, Math.round((stats.total / maximum) * 100));
    return `<div class="weekend-bar-row ${day === 'Sun' ? 'sunday-row' : 'saturday-row'}"><span><b>${day}</b> ${formatDate(record.date, { day: 'numeric', month: 'short' })}</span><i style="--value:${width}%"></i><strong>${stats.total}</strong></div>`;
  }).join('') : '<div class="empty-state">No Sunday or Saturday attendance records exist for the selected period.</div>';
}

function renderHighSundayAttendance(sundayRecords) {
  const target = document.getElementById('highSundayAttendance');
  if (!target) return;
  const ranked = sundayRecords
    .map(record => ({ record, stats: getRecordStats(record) }))
    .sort((a, b) => b.stats.total - a.stats.total || b.record.date.localeCompare(a.record.date));
  const average = ranked.length ? Math.round(ranked.reduce((sum, item) => sum + item.stats.total, 0) / ranked.length) : 0;

  target.innerHTML = ranked.length ? ranked.slice(0, 5).map((item, index) => `<div class="high-attendance-item ${index === 0 ? 'highest-item' : ''}">
    <span class="attendance-rank">${index + 1}</span>
    <div><strong>${formatDate(item.record.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>${escapeHTML(item.record.topic || item.record.service || 'Sunday Service')} • ${item.stats.present} members + ${item.stats.visitors} visitors</small></div>
    <div class="attendance-headcount"><strong>${item.stats.total}</strong><small>${index === 0 ? 'Highest' : item.stats.total >= average ? 'Above average' : 'Total'}</small></div>
  </div>`).join('') : '<div class="empty-state">No Sunday attendance records exist for the selected period.</div>';
}

function renderSemesterMatrixSummary() {
  const target = document.getElementById('semesterMatrixSummary');
  if (!target) return;
  const { semester, sundayRecords, members } = getSemesterMatrixData();
  const totalMarks = sundayRecords.reduce((sum, record) => sum + getRecordStats(record).present, 0);
  target.innerHTML = semester ? `<div><span>Semester</span><strong>${escapeHTML(semesterFullLabel(semester))}</strong></div><div><span>Recorded Sunday weeks</span><strong>${sundayRecords.length}</strong></div><div><span>Members in matrix</span><strong>${members.length}</strong></div><div><span>Total member check-ins</span><strong>${totalMarks}</strong></div>` : '<div class="empty-state">No semester has been selected.</div>';
}

function renderReports() {
  const sundayRecords = getPeriodSundayRecords().slice(0, 8).reverse();
  const allVisitors = getActiveVisitors().filter(visitorMatchesPeriod).length;
  const activeCount = getCurrentMembers().filter(member => getMemberMetrics(member).status === 'active').length;
  const inactiveCount = getCurrentMembers().filter(member => getMemberMetrics(member).status === 'inactive').length;
  const assignedCount = getCurrentMembers().filter(member => member.role !== 'shepherd' && member.shepherdId).length;
  const nonShepherdCount = getCurrentMembers().filter(member => member.role !== 'shepherd').length;
  const coverage = nonShepherdCount ? Math.round((assignedCount / nonShepherdCount) * 100) : 0;
  const avgRate = sundayRecords.length ? Math.round(sundayRecords.reduce((sum, record) => sum + getRecordStats(record).rate, 0) / sundayRecords.length) : 0;

  document.getElementById('reportStats').innerHTML = [
    statCard('Average Sunday Rate', `${avgRate}%`, 'Across latest 8 Sunday services', '%'),
    statCard('Active Members', activeCount, `${inactiveCount} inactive`, '✓'),
    statCard('Visitor Registry', allVisitors, 'Unique visitors recorded', '+'),
    statCard('Shepherd Coverage', `${coverage}%`, `${assignedCount}/${nonShepherdCount} non-shepherd members assigned`, '♧')
  ].join('');

  document.getElementById('reportTrend').innerHTML = sundayRecords.length ? sundayRecords.map(record => {
    const stats = getRecordStats(record);
    return `<div><span>${formatDate(record.date, { day: 'numeric', month: 'short' })}</span><i style="--value:${stats.rate}%"></i><strong>${stats.rate}%</strong></div>`;
  }).join('') : '<div class="empty-state">No Sunday records yet.</div>';

  renderWeekendAttendance(getPeriodServices());
  renderHighSundayAttendance(getPeriodSundayRecords());
  renderSemesterMatrixSummary();

  const careCount = getCareMembers().length;
  const unassigned = getCurrentMembers().filter(member => member.role !== 'shepherd' && !member.shepherdId).length;
  const birthdays = getUpcomingBirthdays(30).length;
  document.getElementById('reportInsights').innerHTML = [
    `<div><span class="activity-icon gold">!</span><p><strong>${careCount} member${careCount === 1 ? '' : 's'} currently need attendance-based review.</strong><small>Open Member Care to see the member and responsible shepherd.</small></p></div>`,
    `<div><span class="activity-icon emerald">♧</span><p><strong>${unassigned} member${unassigned === 1 ? '' : 's'} are not assigned to a shepherd.</strong><small>Assigning them improves accountability when attendance drops.</small></p></div>`,
    `<div><span class="activity-icon ivory">✦</span><p><strong>${birthdays} birthday${birthdays === 1 ? '' : 's'} are coming in the next 30 days.</strong><small>Use the dashboard birthday list for timely wishes.</small></p></div>`
  ].join('');
}

function openModal({ eyebrow = 'FAITHFUL CITY', title, subtitle = '', body, wide = false, onOpen = null }) {
  modalEyebrow.textContent = eyebrow;
  modalTitle.textContent = title;
  modalSubtitle.textContent = subtitle;
  modalBody.innerHTML = body;
  modal.classList.toggle('wide', wide);
  modalBackdrop.hidden = false;
  document.body.classList.add('modal-open');
  modalSubmitHandler = null;
  if (onOpen) onOpen();
}

function closeModal() {
  modalBackdrop.hidden = true;
  document.body.classList.remove('modal-open');
  modal.classList.remove('wide');
  modalSubmitHandler = null;
}

function shepherdOptions(selectedId = '') {
  return `<option value="">Unassigned</option>${getShepherds().map(shepherd => `<option value="${shepherd.id}" ${selectedId === shepherd.id ? 'selected' : ''}>${escapeHTML(shepherd.name)}</option>`).join('')}`;
}

function inviterDatalistOptions() {
  return getCurrentMembers().slice().sort((a, b) => a.name.localeCompare(b.name)).map(member => `<option value="${escapeHTML(member.name)}"></option>`).join('');
}

function findInviterMemberId(invitedByName) {
  const normalizedName = String(invitedByName || '').trim().toLowerCase();
  if (!normalizedName) return null;
  return getCurrentMembers().find(member => member.name.trim().toLowerCase() === normalizedName)?.id || null;
}

function openMemberForm(memberId = null, defaultShepherdId = '') {
  const existing = memberId ? getMember(memberId) : null;
  openModal({
    eyebrow: existing ? 'Edit directory record' : 'New church member',
    title: existing ? `Edit ${existing.name}` : 'Register member',
    subtitle: 'Date of birth supports birthday wishes. Shepherd assignment supports accountability and follow-up.',
    body: `<form class="lux-form" id="memberForm">
      <div class="form-grid two-col">
        <label><span>Full name *</span><input required name="name" value="${escapeHTML(existing?.name || '')}" placeholder="Full name"></label>
        <label><span>Phone number</span><input name="phone" value="${escapeHTML(existing?.phone || '')}" placeholder="e.g. 024 000 0000"></label>
        <label><span>Date of birth</span><input type="date" name="dob" value="${escapeHTML(existing?.dob || '')}"></label>
        <label><span>Date joined</span><input type="date" name="joinedDate" value="${escapeHTML(existing?.joinedDate || isoToday())}"></label>
        <label><span>Church role</span><select name="role"><option value="member" ${existing?.role !== 'shepherd' ? 'selected' : ''}>Member</option><option value="shepherd" ${existing?.role === 'shepherd' ? 'selected' : ''}>Shepherd</option></select></label>
        <label><span>Assigned shepherd</span><select name="shepherdId">${shepherdOptions(existing?.shepherdId || defaultShepherdId)}</select></label>
        <label><span>Programme / school</span><input name="programme" value="${escapeHTML(existing?.programme || '')}" placeholder="e.g. BSc Electrical Engineering"></label>
        <label><span>Expected completion year</span><input type="number" min="2000" max="2100" name="expectedCompletionYear" value="${escapeHTML(existing?.expectedCompletionYear || '')}" placeholder="e.g. 2026"></label>
      </div>
      <label class="check-line"><input type="checkbox" name="priorityContact" ${existing?.priorityContact ? 'checked' : ''}><span>Mark as 🕎 priority contact</span></label>
      <label><span>Notes / known circumstances</span><textarea name="notes" rows="3" placeholder="Optional pastoral context, travel, work schedule, school, health note, etc.">${escapeHTML(existing?.notes || '')}</textarea></label>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">${existing ? 'Save changes' : 'Register member'}</button></div>
    </form>`,
    onOpen: () => {
      const form = document.getElementById('memberForm');
      const roleSelect = form.elements.role;
      const shepherdSelect = form.elements.shepherdId;
      const syncRole = () => { shepherdSelect.disabled = roleSelect.value === 'shepherd'; if (roleSelect.value === 'shepherd') shepherdSelect.value = ''; };
      roleSelect.addEventListener('change', syncRole);
      syncRole();
      form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        const role = data.get('role');
        const payload = {
          name: String(data.get('name')).trim(),
          phone: String(data.get('phone')).trim(),
          dob: String(data.get('dob')),
          joinedDate: String(data.get('joinedDate')),
          role,
          shepherdId: role === 'shepherd' ? null : (String(data.get('shepherdId') || '') || null),
          priorityContact: data.get('priorityContact') === 'on',
          notes: String(data.get('notes')).trim(),
          programme: String(data.get('programme') || '').trim(),
          expectedCompletionYear: String(data.get('expectedCompletionYear') || '').trim()
        };
        if (existing) Object.assign(existing, payload);
        else state.members.push(normalizeMember({ id: uid('member'), ...payload }));
        saveState();
        closeModal();
        renderAll();
        showToast(existing ? 'Member details updated.' : 'Member registered successfully.');
      });
    }
  });
}

function openMemberProfile(memberId) {
  const member = getMember(memberId);
  if (!member) return;
  const metrics = getMemberMetrics(member);
  const shepherd = getMemberShepherd(member);
  const relevantRecords = getSundayRecords().filter(record => isMemberEligibleOnDate(member, record.date)).slice(0, state.settings.windowSize);
  openModal({
    eyebrow: member.role === 'shepherd' ? 'Shepherd profile' : 'Member profile',
    title: member.name,
    subtitle: `${ministryStatusLabel(getMemberMinistryStatus(member))} • ${metrics.rate}% recent Sunday attendance • ${metrics.consecutiveAbsences} consecutive absence${metrics.consecutiveAbsences === 1 ? '' : 's'}`,
    wide: true,
    body: `<div class="profile-summary-grid">
      <div class="profile-hero-card"><span class="member-avatar xlarge">${initials(member.name)}</span><div><h4>${member.priorityContact ? '🕎 ' : ''}${escapeHTML(member.name)}</h4><p>${escapeHTML(member.phone || 'No phone recorded')}</p><span class="priority ${getMemberMinistryStatus(member) === 'current' ? statusClass(metrics.status) : ministryStatusClass(getMemberMinistryStatus(member))}">${getMemberMinistryStatus(member) === 'current' ? statusLabel(metrics.status) : ministryStatusLabel(getMemberMinistryStatus(member))}</span></div></div>
      <div class="profile-facts"><div><span>Birthday</span><strong>${formatDate(member.dob, { day: 'numeric', month: 'long' })}</strong></div><div><span>Joined</span><strong>${formatDate(member.joinedDate)}</strong></div><div><span>Shepherd</span><strong>${member.role === 'shepherd' && isCurrentMember(member) ? 'Registered shepherd' : shepherd ? escapeHTML(shepherd.name) : 'Unassigned'}</strong></div><div><span>Last attended</span><strong>${metrics.lastAttended ? formatDate(metrics.lastAttended) : 'No record'}</strong></div><div><span>Roster status</span><strong>${ministryStatusLabel(getMemberMinistryStatus(member))}</strong></div><div><span>Programme</span><strong>${escapeHTML(member.programme || 'Not recorded')}</strong></div><div><span>Expected completion</span><strong>${escapeHTML(member.expectedCompletionYear || 'Not recorded')}</strong></div><div><span>Status changed</span><strong>${member.statusChangedDate ? formatDate(member.statusChangedDate) : '—'}</strong></div></div>
    </div>
    <div class="member-history-strip">
      ${relevantRecords.length ? relevantRecords.reverse().map(record => `<div class="history-dot ${record.presentMemberIds.includes(member.id) ? 'was-present' : 'was-absent'}"><span>${formatDate(record.date, { day: 'numeric', month: 'short' })}</span><strong>${record.presentMemberIds.includes(member.id) ? 'Present' : 'Absent'}</strong></div>`).join('') : '<div class="empty-state">No Sunday service opportunities recorded yet.</div>'}
    </div>
    ${member.notes ? `<div class="pastoral-note"><strong>Known context / notes</strong><p>${escapeHTML(member.notes)}</p></div>` : ''}
    <div class="modal-actions spread"><div class="button-row"><button class="btn btn-soft" data-edit-member="${member.id}">Edit member</button><button class="btn btn-soft" data-change-member-status="${member.id}">Change roster status</button>${member.role !== 'shepherd' && isCurrentMember(member) ? `<button class="btn btn-soft" data-member-care="${member.id}">Start follow-up</button>` : ''}</div><button class="btn btn-dark" data-delete-member="${member.id}">Delete permanently</button></div>`
  });
}

function openRegisterAttendee() {
  openModal({
    eyebrow: 'Live attendance registration',
    title: 'Add visitor or new member',
    subtitle: 'The person is immediately included in today’s attendance. Visitors must include the name of the person who invited them.',
    body: `<form class="lux-form" id="attendeeForm">
      <label><span>Registration type *</span><select name="type" id="attendeeType"><option value="visitor">Visitor / guest</option><option value="member">New church member</option></select></label>
      <div class="form-grid two-col">
        <label><span>Full name *</span><input required name="name" placeholder="Full name"></label>
        <label><span>Phone number</span><input name="phone" placeholder="e.g. 024 000 0000"></label>
        <label><span>Date of birth *</span><input required type="date" name="dob"></label>
        <label class="visitor-only-field"><span>Invited by *</span><input name="invitedByName" id="attendeeInvitedBy" list="attendeeInviterList" placeholder="Type or choose a member's name"><datalist id="attendeeInviterList">${inviterDatalistOptions()}</datalist></label>
        <label class="member-only-field" hidden><span>Assigned shepherd</span><select name="shepherdId">${shepherdOptions()}</select></label>
      </div>
      <div class="form-help">Visitors are kept in a separate registry and can later be converted to members. Recording who invited them helps the ministry know the personal connection responsible for welcoming and follow-up.</div>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Add to today’s attendance</button></div>
    </form>`,
    onOpen: () => {
      const form = document.getElementById('attendeeForm');
      const typeSelect = document.getElementById('attendeeType');
      const memberOnly = form.querySelector('.member-only-field');
      const visitorOnly = form.querySelector('.visitor-only-field');
      const inviterInput = document.getElementById('attendeeInvitedBy');
      const syncType = () => {
        const isVisitor = typeSelect.value === 'visitor';
        memberOnly.hidden = isVisitor;
        visitorOnly.hidden = !isVisitor;
        inviterInput.required = isVisitor;
      };
      typeSelect.addEventListener('change', syncType);
      syncType();
      form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        const type = String(data.get('type'));
        const name = String(data.get('name')).trim();
        const phone = String(data.get('phone')).trim();
        const dob = String(data.get('dob'));
        const invitedByName = String(data.get('invitedByName') || '').trim();
        const { date } = currentAttendanceKey();

        if (type === 'member') {
          const member = normalizeMember({ id: uid('member'), name, phone, dob, joinedDate: date, role: 'member', shepherdId: String(data.get('shepherdId') || '') || null, priorityContact: false, notes: 'Registered during attendance.' });
          state.members.push(member);
          attendanceDraft.presentMemberIds.add(member.id);
        } else {
          if (!invitedByName) return showToast('Please record the name of the person who invited this visitor.');
          let visitor = state.visitors.find(item => phone && item.phone.replace(/\s/g, '') === phone.replace(/\s/g, '')) || state.visitors.find(item => item.name.toLowerCase() === name.toLowerCase());
          if (!visitor) {
            visitor = normalizeVisitor({ id: uid('visitor'), name, phone, dob, firstVisit: date, lastVisit: date, visits: 0, sourceVisitDates: [], firstVisitSemesterId: getSemesterForDate(date)?.id || state.settings.currentSemesterId, invitedByName, invitedByMemberId: findInviterMemberId(invitedByName) });
            state.visitors.push(visitor);
          } else {
            visitor.name = name;
            visitor.phone = phone || visitor.phone;
            visitor.dob = dob || visitor.dob;
            visitor.invitedByName = visitor.invitedByName || invitedByName;
            visitor.invitedByMemberId = visitor.invitedByMemberId || findInviterMemberId(visitor.invitedByName);
          }
          visitor.visitorStatus = 'active';
          visitor.archivedDate = null;
          attendanceDraft.visitorIds.add(visitor.id);
        }

        saveState();
        closeModal();
        renderAll();
        showToast(`${name} added to today’s attendance.`);
      });
    }
  });
}

function convertVisitorToMember(visitorId) {
  const visitor = getVisitor(visitorId);
  if (!visitor) return;
  openModal({
    eyebrow: 'Visitor journey',
    title: `Make ${visitor.name} a member`,
    subtitle: 'The existing visitor profile and birthday details will be retained.',
    body: `<form class="lux-form" id="convertVisitorForm">
      <div class="profile-facts single-row"><div><span>First visit</span><strong>${formatDate(visitor.firstVisit)}</strong></div><div><span>Total visits</span><strong>${visitor.visits || 0}</strong></div><div><span>Invited by</span><strong>${escapeHTML(visitor.invitedByName || 'Not recorded')}</strong></div></div>
      <label><span>Assign shepherd</span><select name="shepherdId">${shepherdOptions()}</select></label>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Convert to member</button></div>
    </form>`,
    onOpen: () => {
      document.getElementById('convertVisitorForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const member = normalizeMember({
          id: uid('member'), name: visitor.name, phone: visitor.phone, dob: visitor.dob,
          joinedDate: visitor.firstVisit || visitor.lastVisit || isoToday(), joinedSemesterId: visitor.firstVisitSemesterId || '', role: 'member', shepherdId: String(data.get('shepherdId') || '') || null,
          invitedByName: visitor.invitedByName || '', invitedByMemberId: visitor.invitedByMemberId || null,
          priorityContact: false, notes: `Converted from visitor registry after ${visitor.visits || 0} visit(s).${visitor.invitedByName ? ` Originally invited by ${visitor.invitedByName}.` : ''}`
        });
        state.members.push(member);
        state.services.forEach(record => {
          if (record.visitorIds?.includes(visitor.id)) {
            record.visitorIds = record.visitorIds.filter(id => id !== visitor.id);
            if (!record.presentMemberIds.includes(member.id)) record.presentMemberIds.push(member.id);
          }
        });
        attendanceDraft.visitorIds.delete(visitor.id);
        if (currentAttendanceKey().date === member.joinedDate) attendanceDraft.presentMemberIds.add(member.id);
        state.visitors = state.visitors.filter(item => item.id !== visitor.id);
        saveState();
        closeModal();
        renderAll();
        showToast(`${visitor.name} is now a registered member.`);
      });
    }
  });
}


function openStandaloneVisitorForm() {
  openModal({
    eyebrow: 'Visitor registry',
    title: 'Register visitor',
    subtitle: 'Visitors stay separate from the church member roll, and the person who invited them is recorded for connection and follow-up.',
    body: `<form class="lux-form" id="standaloneVisitorForm">
      <div class="form-grid two-col">
        <label><span>Full name *</span><input required name="name" placeholder="Full name"></label>
        <label><span>Phone number</span><input name="phone" placeholder="e.g. 024 000 0000"></label>
        <label><span>Date of birth *</span><input required type="date" name="dob"></label>
        <label><span>First visit date *</span><input required type="date" name="firstVisit" value="${isoToday()}"></label>
        <label><span>Invited by *</span><input required name="invitedByName" list="standaloneInviterList" placeholder="Type or choose a member's name"><datalist id="standaloneInviterList">${inviterDatalistOptions()}</datalist></label>
      </div>
      <div class="form-help">The visitor will appear in the visitor registry with the person who invited them. You can choose an existing member from the suggestions or type another name if the inviter is not yet in the directory.</div>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Register visitor</button></div>
    </form>`,
    onOpen: () => {
      document.getElementById('standaloneVisitorForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const invitedByName = String(data.get('invitedByName')).trim();
        const visitor = normalizeVisitor({
          id: uid('visitor'),
          name: String(data.get('name')).trim(),
          phone: String(data.get('phone')).trim(),
          dob: String(data.get('dob')),
          firstVisit: String(data.get('firstVisit')),
          lastVisit: String(data.get('firstVisit')),
          visits: 1,
          sourceVisitDates: [String(data.get('firstVisit'))],
          firstVisitSemesterId: getSemesterForDate(String(data.get('firstVisit')))?.id || state.settings.currentSemesterId,
          invitedByName,
          invitedByMemberId: findInviterMemberId(invitedByName)
        });
        state.visitors.push(visitor);
        saveState();
        closeModal();
        renderAll();
        showToast(`${visitor.name} registered as a visitor invited by ${visitor.invitedByName}.`);
      });
    }
  });
}

function changeMemberRosterStatus(memberId, newStatus, note = '') {
  const member = getMember(memberId);
  if (!member) return;
  const previousStatus = getMemberMinistryStatus(member);
  member.ministryStatus = newStatus;
  member.statusChangedDate = newStatus === 'current' ? null : isoToday();
  member.statusNote = note || '';

  if (newStatus !== 'current') {
    attendanceDraft.presentMemberIds.delete(member.id);
    if (member.role === 'shepherd') {
      getCurrentMembers().forEach(person => { if (person.shepherdId === member.id) person.shepherdId = null; });
    }
    member.shepherdId = null;
  }

  if (previousStatus !== newStatus) saveState();
}

function openMemberRosterStatusForm(memberId) {
  const member = getMember(memberId);
  if (!member) return;
  const current = getMemberMinistryStatus(member);
  openModal({
    eyebrow: 'Campus roster status',
    title: `Update ${member.name}`,
    subtitle: 'Former students can leave the current attendance list while their historical records remain available.',
    body: `<form class="lux-form" id="memberRosterStatusForm">
      <label><span>Roster status</span><select name="status">
        <option value="current" ${current === 'current' ? 'selected' : ''}>Current ministry member</option>
        <option value="completed" ${current === 'completed' ? 'selected' : ''}>Completed school</option>
        <option value="transferred" ${current === 'transferred' ? 'selected' : ''}>Transferred</option>
        <option value="withdrawn" ${current === 'withdrawn' ? 'selected' : ''}>Left ministry</option>
        <option value="archived" ${current === 'archived' ? 'selected' : ''}>Archived</option>
      </select></label>
      <label><span>Note</span><textarea name="note" rows="3" placeholder="e.g. Completed KNUST in July 2026">${escapeHTML(member.statusNote || '')}</textarea></label>
      <div class="form-help">Any non-current status removes the person from current attendance, care alerts and shepherd-group workload. Old service history remains intact.</div>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Save roster status</button></div>
    </form>`,
    onOpen: () => {
      document.getElementById('memberRosterStatusForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        changeMemberRosterStatus(memberId, String(data.get('status')), String(data.get('note')).trim());
        saveState();
        closeModal();
        renderAll();
        showToast(`${member.name} moved to ${ministryStatusLabel(String(data.get('status')))}.`);
      });
    }
  });
}

function archiveVisitor(visitorId) {
  const visitor = getVisitor(visitorId);
  if (!visitor) return;
  visitor.visitorStatus = 'archived';
  visitor.archivedDate = isoToday();
  attendanceDraft.visitorIds.delete(visitorId);
  saveState();
  renderAll();
  showToast(`${visitor.name} archived from the current visitor list.`);
}

function restoreVisitor(visitorId) {
  const visitor = getVisitor(visitorId);
  if (!visitor) return;
  visitor.visitorStatus = 'active';
  visitor.archivedDate = null;
  saveState();
  renderAll();
  showToast(`${visitor.name} restored to the current visitor list.`);
}

function deleteVisitorPermanently(visitorId) {
  const visitor = getVisitor(visitorId);
  if (!visitor) return;
  if (!confirm(`Permanently delete ${visitor.name}? This also removes their visitor references from past attendance records.`)) return;
  state.visitors = state.visitors.filter(item => item.id !== visitorId);
  state.services.forEach(record => { record.visitorIds = (record.visitorIds || []).filter(id => id !== visitorId); });
  attendanceDraft.visitorIds.delete(visitorId);
  saveState();
  renderAll();
  showToast(`${visitor.name} permanently deleted.`);
}

function getRosterFilteredMembers() {
  const query = (document.getElementById('rosterSearch')?.value || '').trim().toLowerCase();
  const lifecycle = document.getElementById('rosterLifecycleFilter')?.value || 'current';
  return state.members.filter(member => {
    const status = getMemberMinistryStatus(member);
    const haystack = `${member.name} ${member.phone || ''} ${member.programme || ''} ${member.expectedCompletionYear || ''} ${ministryStatusLabel(status)}`.toLowerCase();
    return (lifecycle === 'all' || status === lifecycle) && haystack.includes(query);
  }).sort((a, b) => a.name.localeCompare(b.name));
}


function openSemesterForm(semesterId = null) {
  const existing = semesterId ? getSemester(semesterId) : null;
  openModal({
    eyebrow: existing ? 'Edit academic period' : 'New academic period',
    title: existing ? `Edit ${semesterFullLabel(existing)}` : 'Create semester',
    subtitle: 'Attendance, visitors, topics and special programs can be separated by academic year, semester and calendar year.',
    body: `<form class="lux-form" id="semesterForm">
      <div class="form-grid two-col">
        <label><span>Semester name *</span><input required name="name" value="${escapeHTML(existing?.name || '')}" placeholder="e.g. First Semester"></label>
        <label><span>Academic year *</span><input required name="academicYear" value="${escapeHTML(existing?.academicYear || '')}" placeholder="e.g. 2026/2027"></label>
        <label><span>Calendar year *</span><input required pattern="\\d{4}" name="calendarYear" value="${escapeHTML(existing?.calendarYear || String(new Date().getFullYear()))}" placeholder="e.g. 2026"></label>
        <label><span>Status</span><select name="active"><option value="true" ${existing?.active !== false ? 'selected' : ''}>Active</option><option value="false" ${existing?.active === false ? 'selected' : ''}>Archived</option></select></label>
        <label><span>Start date *</span><input required type="date" name="startDate" value="${escapeHTML(existing?.startDate || '')}"></label>
        <label><span>End date *</span><input required type="date" name="endDate" value="${escapeHTML(existing?.endDate || '')}"></label>
      </div>
      <label><span>Notes</span><textarea name="notes" rows="3">${escapeHTML(existing?.notes || '')}</textarea></label>
      <label class="check-line"><input type="checkbox" name="makeCurrent" ${existing?.id === state.settings.currentSemesterId ? 'checked' : ''}><span>Make this the current semester for Sunday activity classification</span></label>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Save semester</button></div>
    </form>`,
    onOpen: () => {
      document.getElementById('semesterForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const startDate = String(data.get('startDate') || '');
        const endDate = String(data.get('endDate') || '');
        if (endDate < startDate) return showToast('Semester end date cannot be earlier than the start date.');
        const values = normalizeSemester({
          name: String(data.get('name') || '').trim(),
          academicYear: String(data.get('academicYear') || '').trim(),
          calendarYear: String(data.get('calendarYear') || '').trim(),
          startDate, endDate,
          active: String(data.get('active')) !== 'false',
          current: Boolean(data.get('makeCurrent')),
          notes: String(data.get('notes') || '').trim()
        });
        let semester = existing;
        if (semester) Object.assign(semester, values);
        else { semester = { id: uid('semester'), ...values }; state.semesters.push(semester); }
        if (data.get('makeCurrent')) {
          state.settings.currentSemesterId = semester.id;
          state.semesters.forEach(item => { item.current = item.id === semester.id; });
          periodFilter = { academicYear: semester.academicYear || 'all', calendarYear: semester.calendarYear || 'all', semesterId: semester.id };
        }
        saveState(); closeModal(); renderAll();
        showToast(`${semesterFullLabel(semester)} saved.`);
      });
    }
  });
}

function setCurrentSemester(semesterId) {
  const semester = getSemester(semesterId); if (!semester) return;
  state.settings.currentSemesterId = semester.id;
  state.semesters.forEach(item => { item.current = item.id === semester.id; });
  periodFilter = { academicYear: semester.academicYear || 'all', calendarYear: semester.calendarYear || 'all', semesterId: semester.id };
  saveState(); renderAll(); showToast(`${semesterFullLabel(semester)} is now the current semester.`);
}

function toggleSemesterArchive(semesterId) {
  const semester = getSemester(semesterId); if (!semester) return;
  if (semester.id === state.settings.currentSemesterId && semester.active !== false) return showToast('Choose another current semester before archiving this one.');
  semester.active = semester.active === false;
  saveState(); renderAll(); showToast(semester.active ? 'Semester restored.' : 'Semester archived. Historical records are preserved.');
}

function renderSemesterManager() {
  const list = document.getElementById('semesterManagerList');
  if (!list) return;
  const semesters = (state.semesters || []).slice().sort((a,b)=>(b.startDate || '').localeCompare(a.startDate || ''));
  list.innerHTML = semesters.length ? semesters.map(semester => {
    const recordCount = state.services.filter(record => getRecordSemester(record)?.id === semester.id).length;
    const visitorCount = state.visitors.filter(visitor => getVisitorSemester(visitor)?.id === semester.id).length;
    const current = semester.id === state.settings.currentSemesterId;
    return `<article class="semester-card ${current ? 'current-semester-card' : ''}">
      <div><span class="eyebrow">${escapeHTML(semester.academicYear || 'Academic year not set')}</span><h4>${escapeHTML(semester.name || 'Unnamed semester')}</h4><p>${formatDate(semester.startDate)} – ${formatDate(semester.endDate)} • Calendar year ${escapeHTML(semester.calendarYear || '—')}</p></div>
      <div class="semester-card-metrics"><span><strong>${recordCount}</strong> attendance records</span><span><strong>${visitorCount}</strong> visitors</span></div>
      <div class="button-row"><button class="btn btn-soft compact-btn" data-semester-edit="${semester.id}">Edit</button>${current ? '<span class="service-chip">Current semester</span>' : `<button class="btn btn-soft compact-btn" data-semester-current="${semester.id}">Make current</button>`}<button class="btn btn-soft compact-btn" data-semester-toggle="${semester.id}">${semester.active === false ? 'Restore' : 'Archive'}</button></div>
    </article>`;
  }).join('') : '<div class="empty-state">No semesters have been created yet.</div>';
}

function renderSettings() {
  renderSemesterManager();
  const host = document.getElementById('rosterStats');
  if (!host) return;
  const counts = status => state.members.filter(member => getMemberMinistryStatus(member) === status).length;
  host.innerHTML = [
    statCard('Current', counts('current'), 'Included in attendance and care', '✓'),
    statCard('Completed School', counts('completed'), 'History retained', '✦'),
    statCard('Transferred / Left', counts('transferred') + counts('withdrawn'), 'No longer current roster', '↗'),
    statCard('Archived', counts('archived'), 'Hidden from operational lists', '◷')
  ].join('');

  const summary = document.getElementById('settingsRuleSummary');
  if (summary) summary.textContent = `Within ${semesterFullLabel(getCurrentSemester())}, a member moves to Needs Help (Green) after ${state.settings.warningConsecutiveMisses || 2} consecutive Sunday OR Thursday misses, and Urgent Contact (Red) after ${state.settings.criticalConsecutiveMisses || 5}. Former or archived members are excluded automatically.`;

  const body = document.getElementById('rosterTableBody');
  if (!body) return;
  const members = getRosterFilteredMembers();
  body.innerHTML = members.length ? members.map(member => {
    const checked = bulkSelectedMemberIds.has(member.id);
    const lifecycle = getMemberMinistryStatus(member);
    return `<tr>
      <td><input type="checkbox" data-roster-select="${member.id}" ${checked ? 'checked' : ''}></td>
      <td><div class="table-person"><span class="member-avatar">${initials(member.name)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${escapeHTML(member.phone || 'No phone')}</small></div></div></td>
      <td>${member.role === 'shepherd' ? '<span class="role-chip">Shepherd</span>' : 'Member'}</td>
      <td><span class="priority ${ministryStatusClass(lifecycle)}">${ministryStatusLabel(lifecycle)}</span></td>
      <td>${escapeHTML(member.expectedCompletionYear || '—')}</td>
      <td>${member.statusChangedDate ? formatDate(member.statusChangedDate) : '—'}</td>
    </tr>`;
  }).join('') : '<tr><td colspan="6"><div class="empty-state">No roster records match this filter.</div></td></tr>';

  const count = bulkSelectedMemberIds.size;
  document.getElementById('rosterSelectedCount').textContent = `${count} selected`;
  document.getElementById('rosterSelectionHint').textContent = count ? 'Choose an action below. Archive is safest when you only want people removed from current operational lists.' : 'Choose members below, then apply a roster action.';
  const allVisibleSelected = members.length > 0 && members.every(member => bulkSelectedMemberIds.has(member.id));
  const headerCheckbox = document.getElementById('rosterHeaderCheckbox');
  if (headerCheckbox) headerCheckbox.checked = allVisibleSelected;
}

function applyBulkRosterAction() {
  const action = document.getElementById('bulkRosterAction')?.value || '';
  const note = document.getElementById('bulkRosterNote')?.value.trim() || '';
  const ids = [...bulkSelectedMemberIds].filter(id => getMember(id));
  if (!ids.length) return showToast('Select at least one member first.');
  if (!action) return showToast('Choose a roster action.');

  if (action === 'delete') {
    if (!confirm(`Permanently delete ${ids.length} selected member record${ids.length === 1 ? '' : 's'}? Their attendance references will also be removed. This cannot be undone unless you have a backup.`)) return;
    const deletedIds = new Set(ids);
    state.members = state.members.filter(member => !deletedIds.has(member.id));
    state.members.forEach(member => { if (deletedIds.has(member.shepherdId)) member.shepherdId = null; });
    state.services.forEach(record => { record.presentMemberIds = record.presentMemberIds.filter(id => !deletedIds.has(id)); });
    state.careNotes = state.careNotes.filter(noteItem => !deletedIds.has(noteItem.memberId));
    ids.forEach(id => attendanceDraft.presentMemberIds.delete(id));
    bulkSelectedMemberIds.clear();
    saveState();
    renderAll();
    showToast(`${ids.length} member record${ids.length === 1 ? '' : 's'} permanently deleted.`);
    return;
  }

  ids.forEach(id => changeMemberRosterStatus(id, action, note));
  bulkSelectedMemberIds.clear();
  saveState();
  renderAll();
  showToast(`${ids.length} member${ids.length === 1 ? '' : 's'} moved to ${ministryStatusLabel(action)}.`);
}

function openManageShepherd() {
  const candidates = getCurrentMembers().filter(member => member.role !== 'shepherd').sort((a, b) => a.name.localeCompare(b.name));
  openModal({
    eyebrow: 'Pastoral structure',
    title: 'Register a shepherd',
    subtitle: 'Select an existing church member and designate them as a shepherd.',
    body: candidates.length ? `<form class="lux-form" id="shepherdForm"><label><span>Select member *</span><select required name="memberId"><option value="">Choose a member</option>${candidates.map(member => `<option value="${member.id}">${escapeHTML(member.name)} • ${escapeHTML(member.phone || 'No phone')}</option>`).join('')}</select></label><div class="form-help">The selected person remains in the member directory but can now receive assigned members and appear as the responsible shepherd in care alerts.</div><div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Register as shepherd</button></div></form>` : '<div class="empty-state">Every current member is already registered as a shepherd. Add another member first.</div>',
    onOpen: () => {
      const form = document.getElementById('shepherdForm');
      if (!form) return;
      form.addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(form);
        const member = getMember(String(data.get('memberId')));
        if (!member) return;
        member.role = 'shepherd';
        member.shepherdId = null;
        saveState();
        closeModal();
        renderAll();
        showToast(`${member.name} registered as a shepherd.`);
      });
    }
  });
}

function openAssignMember(shepherdId) {
  const shepherd = getMember(shepherdId);
  const candidates = getCurrentMembers().filter(member => member.id !== shepherdId && member.role !== 'shepherd').sort((a, b) => a.name.localeCompare(b.name));
  if (!shepherd) return;
  openModal({
    eyebrow: 'Shepherd group assignment',
    title: `Assign members to ${shepherd.name}`,
    subtitle: 'You can select more than one member. Existing assignments to another shepherd will be replaced.',
    body: `<form class="lux-form" id="assignMemberForm"><div class="assignment-checklist">${candidates.map(member => `<label><input type="checkbox" name="memberIds" value="${member.id}" ${member.shepherdId === shepherdId ? 'checked' : ''}><span class="member-avatar">${initials(member.name)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${member.shepherdId && member.shepherdId !== shepherdId ? `Currently: ${escapeHTML(getMember(member.shepherdId)?.name || 'Another shepherd')}` : member.shepherdId === shepherdId ? 'Already assigned here' : 'Unassigned'}</small></div></label>`).join('')}</div><div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Save group</button></div></form>`,
    wide: true,
    onOpen: () => {
      document.getElementById('assignMemberForm').addEventListener('submit', event => {
        event.preventDefault();
        const selected = new Set(new FormData(event.currentTarget).getAll('memberIds').map(String));
        candidates.forEach(member => {
          if (selected.has(member.id)) member.shepherdId = shepherdId;
          else if (member.shepherdId === shepherdId) member.shepherdId = null;
        });
        saveState();
        closeModal();
        renderAll();
        showToast(`${shepherd.name}'s group updated.`);
      });
    }
  });
}

function openShepherdGroup(shepherdId) {
  const shepherd = getMember(shepherdId);
  if (!shepherd) return;
  const flock = getCurrentMembers().filter(member => member.shepherdId === shepherdId).sort((a, b) => a.name.localeCompare(b.name));
  openModal({
    eyebrow: 'Shepherd group',
    title: shepherd.name,
    subtitle: `${flock.length} member${flock.length === 1 ? '' : 's'} assigned • ${escapeHTML(shepherd.phone || 'No phone recorded')}`,
    wide: true,
    body: `<div class="flock-table">${flock.length ? flock.map(member => {
      const metrics = getMemberMetrics(member);
      return `<div class="flock-row"><span class="member-avatar">${initials(member.name)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${metrics.rate}% attendance • ${metrics.consecutiveAbsences} consecutive absence${metrics.consecutiveAbsences === 1 ? '' : 's'}</small></div><span class="priority ${statusClass(metrics.status)}">${statusLabel(metrics.status)}</span><button class="row-action" data-member-view="${member.id}">View</button></div>`;
    }).join('') : '<div class="empty-state">No members assigned to this shepherd yet.</div>'}</div><div class="modal-actions"><button class="btn btn-soft" data-assign-shepherd="${shepherd.id}">Manage assignments</button></div>`
  });
}

function openCareAction(memberId) {
  const member = getMember(memberId);
  if (!member) return;
  const metrics = getMemberMetrics(member);
  const shepherd = getMemberShepherd(member);
  openModal({
    eyebrow: 'Compassionate follow-up',
    title: `Care plan for ${member.name}`,
    subtitle: shepherd ? `Responsible shepherd: ${shepherd.name} • ${shepherd.phone || 'No phone recorded'}` : 'No shepherd assigned to this member yet.',
    body: `<div class="care-reason-box"><strong>Why the system flagged this member</strong><p>${metrics.rate}% attendance across ${metrics.opportunities} recent Sunday opportunities, with ${metrics.consecutiveAbsences} consecutive absence${metrics.consecutiveAbsences === 1 ? '' : 's'}.</p></div>
      <form class="lux-form" id="careActionForm">
        <label><span>Follow-up action</span><select name="action"><option>Phone call</option><option>WhatsApp message</option><option>Personal visit</option><option>Prayer and monitoring</option><option>Ask shepherd for context</option></select></label>
        <label><span>Care note</span><textarea name="note" rows="4" placeholder="Record what is known or what was discussed. Avoid judgmental language."></textarea></label>
        <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Save follow-up note</button></div>
      </form>`,
    onOpen: () => {
      document.getElementById('careActionForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        state.careNotes.push({ id: uid('care'), memberId, shepherdId: shepherd?.id || null, date: new Date().toISOString(), action: String(data.get('action')), note: String(data.get('note')).trim() });
        saveState();
        closeModal();
        showToast(`Follow-up note saved for ${member.name}.`);
      });
    }
  });
}

function openHistoryRecord(recordId) {
  const record = state.services.find(item => item.id === recordId);
  if (!record) return;
  const present = getPresentEligibleMembers(record);
  const absent = getAbsentees(record);
  const visitors = (record.visitorIds || []).map(getVisitor).filter(Boolean);
  const stats = getRecordStats(record);
  const program = getProgramForRecord(record);
  openModal({
    eyebrow: `${programTypeLabel(program?.type || record.eventType)} • Attendance record`,
    title: `${record.service} — ${formatDate(record.date)}`,
    subtitle: `${stats.present} registered members present • ${stats.absent} absent • ${stats.visitors} visitors • ${stats.total} total attendance`,
    wide: true,
    body: `<div class="ministry-record-panel">
      <div><span>Topic / sermon / teaching</span><strong>${escapeHTML(record.topic || 'Not recorded')}</strong></div>
      <div><span>Minister / speaker</span><strong>${escapeHTML(record.minister || 'Not recorded')}</strong></div>
      <div><span>Scripture / reference</span><strong>${escapeHTML(record.scripture || 'Not recorded')}</strong></div>
      <div><span>Program type</span><strong>${escapeHTML(programTypeLabel(program?.type || record.eventType))}</strong></div>
    </div>
    ${record.notes ? `<div class="care-reason-box"><strong>Service / program notes</strong><p>${escapeHTML(record.notes)}</p></div>` : ''}
    ${program?.type === 'special' ? `<div class="special-record-context"><span>${escapeHTML(program.semester || 'Special program')}</span><strong>${escapeHTML(program.theme || program.name)}</strong><small>${escapeHTML([program.venue, program.organizer].filter(Boolean).join(' • '))}</small></div>` : ''}
    <div class="history-detail-grid">
      <section><h4>Members present (${present.length})</h4><div class="name-chip-list">${present.map(member => `<button data-member-view="${member.id}">${escapeHTML(member.name)}</button>`).join('') || '<span>None</span>'}</div></section>
      <section><h4>Members absent (${absent.length})</h4><div class="name-chip-list absent-chips">${absent.map(member => `<button data-member-view="${member.id}">${escapeHTML(member.name)}</button>`).join('') || '<span>None</span>'}</div></section>
      <section><h4>Visitors / new attendees (${visitors.length})</h4><div class="name-chip-list visitor-chips">${visitors.map(visitor => `<button data-convert-visitor="${visitor.id}">${escapeHTML(visitor.name)}${visitor.invitedByName ? ` · invited by ${escapeHTML(visitor.invitedByName)}` : ''} · Make member</button>`).join('') || '<span>None</span>'}</div></section>
    </div>`
  });
}

function openRuleSettings() {
  openModal({
    eyebrow: 'Automatic classification',
    title: 'Adjust attendance classification rule',
    subtitle: 'Sunday and Thursday are evaluated separately. Reaching either threshold moves the member to the corresponding zone.',
    body: `<form class="lux-form" id="ruleSettingsForm">
      <div class="form-grid two-col">
        <label><span>Needs Help — Green threshold</span><input type="number" min="2" max="4" name="warningConsecutiveMisses" value="${state.settings.warningConsecutiveMisses || 2}"></label>
        <label><span>Urgent Contact — Red threshold</span><input type="number" min="3" max="12" name="criticalConsecutiveMisses" value="${state.settings.criticalConsecutiveMisses || 5}"></label>
        <label><span>Sunday percentage window</span><input type="number" min="3" max="52" name="windowSize" value="${state.settings.windowSize}"></label>
        <label><span>Learning opportunities</span><input type="number" min="1" max="8" name="learningMinimumServices" value="${state.settings.learningMinimumServices}"></label>
      </div>
      <div class="form-help">Default rule: two consecutive Sunday misses OR two consecutive Thursday misses moves a member to Green. Five consecutive misses in either meeting stream moves the member to Red and requires immediate contact.</div>
      <div class="modal-actions"><button type="button" class="btn btn-soft" data-modal-cancel>Cancel</button><button class="btn btn-gold" type="submit">Save rule</button></div>
    </form>`,
    onOpen: () => {
      document.getElementById('ruleSettingsForm').addEventListener('submit', event => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const warning = Number(data.get('warningConsecutiveMisses'));
        const critical = Number(data.get('criticalConsecutiveMisses'));
        if (critical <= warning) return showToast('The red threshold must be higher than the green threshold.');
        state.settings.warningConsecutiveMisses = warning;
        state.settings.criticalConsecutiveMisses = critical;
        state.settings.windowSize = Number(data.get('windowSize'));
        state.settings.learningMinimumServices = Number(data.get('learningMinimumServices'));
        saveState(); closeModal(); renderAll(); showToast('Automatic classification rule updated.');
      });
    }
  });
}

function openBirthdayModal() {
  const birthdays = getUpcomingBirthdays(60);
  openModal({
    eyebrow: 'Birthday care',
    title: 'Upcoming birthdays',
    subtitle: 'Members with birthdays in the next 60 days.',
    body: birthdays.length ? `<div class="birthday-modal-list">${birthdays.map(({ member, next, daysAway }) => `<div class="birthday-item"><span class="member-avatar">${initials(member.name)}</span><div><strong>${escapeHTML(member.name)}</strong><small>${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long' }).format(next)} • ${getBirthdayText(daysAway)}</small></div><button class="row-action" data-member-view="${member.id}">View</button></div>`).join('')}</div>` : '<div class="empty-state">No birthdays in the next 60 days.</div>'
  });
}

function deleteMember(memberId) {
  const member = getMember(memberId);
  if (!member) return;
  if (!confirm(`Permanently delete ${member.name}? This removes the directory record and their attendance references. For students who completed school, use a roster status instead so history is preserved.`)) return;
  state.members = state.members.filter(item => item.id !== memberId);
  state.members.forEach(item => { if (item.shepherdId === memberId) item.shepherdId = null; });
  state.services.forEach(record => { record.presentMemberIds = record.presentMemberIds.filter(id => id !== memberId); });
  state.careNotes = state.careNotes.filter(note => note.memberId !== memberId);
  attendanceDraft.presentMemberIds.delete(memberId);
  bulkSelectedMemberIds.delete(memberId);
  saveState();
  closeModal();
  renderAll();
  showToast(`${member.name} permanently deleted.`);
}

function downloadFile(filename, content, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function csvEscape(value) {
  const text = String(value ?? '');
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportMembersCsv() {
  const rows = [['Name','Phone','Date of Birth','Joined Date','Role','Shepherd','Programme','Expected Completion Year','Roster Status','Status Changed Date','Attendance Rate','Activity Status','Consecutive Absences','Priority Contact']];
  state.members.forEach(member => {
    const metrics = getMemberMetrics(member);
    rows.push([member.name, member.phone, member.dob, member.joinedDate, member.role, getMemberShepherd(member)?.name || '', member.programme || '', member.expectedCompletionYear || '', ministryStatusLabel(getMemberMinistryStatus(member)), member.statusChangedDate || '', metrics.rate, statusLabel(metrics.status), metrics.consecutiveAbsences, member.priorityContact ? 'Yes' : 'No']);
  });
  downloadFile(`faithful-city-members-${isoToday()}.csv`, rows.map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
}


function exportVisitorsCsv() {
  const rows = [['Name','Phone','Invited By','Date of Birth','First Visit','Last Visit','Total Visits','Academic Year','Semester','Calendar Year','Visitor Status']];
  state.visitors.filter(visitorMatchesPeriod).forEach(visitor => {
    const semester = getVisitorSemester(visitor);
    rows.push([visitor.name, visitor.phone, visitor.invitedByName || '', visitor.dob, visitor.firstVisit, visitor.lastVisit, visitor.visits || 0, semester?.academicYear || '', semester?.name || '', visitor.firstVisit?.slice(0,4) || semester?.calendarYear || '', visitor.visitorStatus || 'active']);
  });
  downloadFile(`faithful-city-visitors-${isoToday()}.csv`, rows.map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

function exportAttendanceCsv() {
  const rows = [['Date','Academic Year','Semester','Calendar Year','Service or Program','Program Type','Topic Ministered','Minister or Speaker','Scripture or Reference','Notes','Members Present','Members Absent','Visitors/New','Total Attendance','Member Attendance Rate']];
  [...getPeriodServices()].sort((a, b) => b.date.localeCompare(a.date)).forEach(record => {
    const stats = getRecordStats(record);
    const program = getProgramForRecord(record);
    const semester = getRecordSemester(record);
    rows.push([record.date, semester?.academicYear || record.academicYear || '', semester?.name || '', record.calendarYear || record.date?.slice(0,4) || '', record.service, programTypeLabel(program?.type || record.eventType), record.topic || '', record.minister || '', record.scripture || '', record.notes || '', stats.present, stats.absent, stats.visitors, stats.total, `${stats.rate}%`]);
  });
  downloadFile(`faithful-city-attendance-and-ministry-${isoToday()}.csv`, rows.map(row => row.map(csvEscape).join(',')).join('\n'), 'text/csv;charset=utf-8');
}


async function importMemberDataUpdate(file) {
  try {
    const payload = JSON.parse(await file.text());
    const entries = Array.isArray(payload.members) ? payload.members : [];
    if (!entries.length) throw new Error('The update file contains no member records.');
    const normalizeName = value => String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\b(pastor|sofo|lady)\b/g,'').replace(/[^a-z0-9]+/g,' ').trim();
    let updated = 0, added = 0;
    entries.forEach(entry => {
      let member = state.members.find(item => normalizeName(item.name) === normalizeName(entry.name));
      if (!member && entry.addIfMissing !== false) {
        member = normalizeMember({ id: uid('member'), name: entry.name, phone: '', dob: '', joinedDate: entry.joinedDate || isoToday(), role: 'member', shepherdId: null, priorityContact: false, notes: '', ministryStatus: 'current' });
        state.members.push(member); added += 1;
      }
      if (!member) return;
      ['dob','classificationBaseline','classificationSource','birthdayImportSource'].forEach(key => { if (entry[key]) member[key] = entry[key]; });
      if (entry.phone && !member.phone) member.phone = entry.phone;
      if (entry.hostel && !(member.notes || '').toLowerCase().includes(`hostel: ${String(entry.hostel).toLowerCase()}`)) member.notes = `${member.notes ? `${member.notes}\n` : ''}Hostel: ${entry.hostel}`;
      updated += 1;
    });
    saveState(); renderAll(); showToast(`Member update imported: ${updated} records updated, ${added} new members added.`);
  } catch (error) { console.error(error); showToast(`Could not import member update: ${error.message}`); }
}

function exportBackup() {
  downloadFile(`faithful-city-doxa-portal-backup-${isoToday()}.json`, JSON.stringify(state, null, 2), 'application/json');
}

function importBackup(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.members) || !Array.isArray(parsed.services)) throw new Error('Invalid ChurchCare backup');
      state = normalizeLoadedState(parsed);
      saveState();
      loadAttendanceDraft();
      renderAll();
      showToast('FAITHFUL CITY DOXA PORTAL FAMILY backup restored successfully.');
    } catch (error) {
      console.error(error);
      showToast('That file is not a valid ChurchCare backup.');
    }
  };
  reader.readAsText(file);
}

function deleteAllSiteData() {
  const firstConfirmation = confirm('Delete ALL ChurchCare data from the shared cloud database? This will remove every member, visitor, attendance record, shepherd assignment, care note, birthday record, and roster record. This cannot be undone unless you already have a backup.');
  if (!firstConfirmation) return;

  const secondConfirmation = confirm('FINAL CONFIRMATION (2 of 2): Are you absolutely sure you want to permanently delete ALL information on this site? Press OK only if you truly want to erase everything.');
  if (!secondConfirmation) {
    showToast('Deletion cancelled. No data was removed.');
    return;
  }

  localStorage.removeItem(STORAGE_KEY);
  state = normalizeLoadedState({
    version: APP_VERSION,
    settings: clone(seedData.settings),
    semesters: clone(seedData.semesters),
    programs: clone(seedData.programs).filter(program => program.fixed),
    members: [],
    visitors: [],
    services: [],
    careNotes: []
  });
  attendanceDraft = { presentMemberIds: new Set(), visitorIds: new Set(), meta: { topic: '', minister: '', scripture: '', notes: '' } };
  bulkSelectedMemberIds.clear();
  saveState();
  loadAttendanceDraft();
  renderAll();
  switchPage('dashboard');
  showToast('All FAITHFUL CITY DOXA PORTAL FAMILY shared site data has been permanently deleted.');
}

function resetDemoData() {
  if (!confirm('Restore the public empty starter state? This will replace the shared cloud data unless you have exported a backup.')) return;
  state = normalizeLoadedState(clone(seedData));
  saveState();
  loadAttendanceDraft();
  renderAll();
  showToast('Public empty starter state restored.');
}

// Navigation and core controls.
menuBtn?.addEventListener('click', () => setMobileMenuOpen(!sidebar?.classList.contains('open')));
sidebarCloseBtn?.addEventListener('click', () => setMobileMenuOpen(false));
mobileNavBackdrop?.addEventListener('click', () => setMobileMenuOpen(false));
mobileMoreBtn?.addEventListener('click', () => setMobileMenuOpen(true));
document.querySelectorAll('[data-mobile-go]').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.mobileGo)));
mobilePeriodBtn?.addEventListener('click', openMobilePeriodFilters);
window.addEventListener('resize', () => { if (!window.matchMedia('(max-width: 860px)').matches) setMobileMenuOpen(false); });
document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchPage(item.dataset.section)));
document.getElementById('startAttendanceBtn')?.addEventListener('click', () => switchPage('attendance'));
document.getElementById('viewCareBtn')?.addEventListener('click', () => switchPage('followup'));
document.querySelectorAll('[data-go]').forEach(button => button.addEventListener('click', () => switchPage(button.dataset.go)));

document.getElementById('addMemberBtn')?.addEventListener('click', () => openMemberForm());
document.getElementById('addVisitorBtn')?.addEventListener('click', openStandaloneVisitorForm);
document.getElementById('manageShepherdBtn')?.addEventListener('click', openManageShepherd);
document.getElementById('addAttendeeBtn')?.addEventListener('click', openRegisterAttendee);
document.getElementById('addSpecialProgramBtn')?.addEventListener('click', () => openSpecialProgramForm());
document.getElementById('quickAddSpecialProgramBtn')?.addEventListener('click', () => openSpecialProgramForm());
document.getElementById('manageProgramsBtn')?.addEventListener('click', () => switchPage('programs'));
document.getElementById('saveAttendance')?.addEventListener('click', saveAttendanceRecord);
document.getElementById('openRuleSettings')?.addEventListener('click', openRuleSettings);
document.getElementById('openRuleSettingsFromSettings')?.addEventListener('click', openRuleSettings);
document.getElementById('openRuleSettingsSecondary')?.addEventListener('click', openRuleSettings);
document.getElementById('quickSettingsBtn')?.addEventListener('click', () => switchPage('settings'));
document.getElementById('programReminderBell')?.addEventListener('click', openProgramRemindersModal);
document.getElementById('enableProgramNotifications')?.addEventListener('click', requestProgramNotificationPermission);
document.getElementById('birthdayBell')?.addEventListener('click', openBirthdayModal);
document.getElementById('addSemesterBtn')?.addEventListener('click', () => openSemesterForm());
['periodAcademicYearFilter','periodCalendarYearFilter','periodSemesterFilter'].forEach(id => document.getElementById(id)?.addEventListener('change', updatePeriodFilterFromControls));

document.getElementById('attendanceDate').value = isoToday();
document.getElementById('todayLabel').textContent = formatLongToday();

document.getElementById('memberSearch')?.addEventListener('input', renderMembers);
document.getElementById('memberLifecycleFilter')?.addEventListener('change', renderMembers);
document.getElementById('visitorSearch')?.addEventListener('input', renderVisitors);
document.getElementById('visitorRegistryFilter')?.addEventListener('change', renderVisitors);
document.getElementById('memberStatusFilter')?.addEventListener('change', renderMembers);
document.getElementById('memberShepherdFilter')?.addEventListener('change', renderMembers);
document.getElementById('attendanceSearch')?.addEventListener('input', renderAttendance);
document.getElementById('attendanceShepherdFilter')?.addEventListener('change', renderAttendance);
document.getElementById('historySearch')?.addEventListener('input', renderHistory);
document.getElementById('historyServiceFilter')?.addEventListener('change', renderHistory);
document.getElementById('rosterSearch')?.addEventListener('input', renderSettings);
document.getElementById('rosterLifecycleFilter')?.addEventListener('change', renderSettings);

document.getElementById('serviceSelect')?.addEventListener('change', loadAttendanceDraft);
document.getElementById('attendanceDate')?.addEventListener('change', loadAttendanceDraft);
['eventTopic', 'eventMinister', 'eventScripture', 'eventNotes'].forEach(id => document.getElementById(id)?.addEventListener('input', syncAttendanceDraftMetaFromFields));

document.getElementById('markAllPresent')?.addEventListener('click', () => {
  const { date } = currentAttendanceKey();
  state.members.filter(member => isMemberEligibleOnDate(member, date)).forEach(member => attendanceDraft.presentMemberIds.add(member.id));
  renderAttendance();
});

document.getElementById('clearAttendance')?.addEventListener('click', () => {
  attendanceDraft.presentMemberIds.clear();
  renderAttendance();
});

document.getElementById('attendanceRegister')?.addEventListener('change', event => {
  const input = event.target.closest('[data-attendance-member]');
  if (!input) return;
  if (input.checked) attendanceDraft.presentMemberIds.add(input.dataset.attendanceMember);
  else attendanceDraft.presentMemberIds.delete(input.dataset.attendanceMember);
  const row = input.closest('.attendance-row');
  if (row) row.querySelector('.attendance-status').textContent = input.checked ? 'Present' : 'Absent';
  updateAttendanceCounts();
});

document.getElementById('exportMembersCsv')?.addEventListener('click', exportMembersCsv);
document.getElementById('exportVisitorsCsv')?.addEventListener('click', exportVisitorsCsv);
document.getElementById('exportAttendanceCsv')?.addEventListener('click', exportAttendanceCsv);
document.getElementById('exportSemesterMatrixCsv')?.addEventListener('click', exportSemesterMatrixCsv);
document.getElementById('exportSemesterMatrixCsvSecondary')?.addEventListener('click', exportSemesterMatrixCsv);
document.getElementById('exportClassificationCsv')?.addEventListener('click', exportClassificationCsv);
document.getElementById('authLoginForm')?.addEventListener('submit', signInToChurchCare);
document.getElementById('signOutBtn')?.addEventListener('click', signOutOfChurchCare);
document.getElementById('mobileSignOutBtn')?.addEventListener('click', signOutOfChurchCare);

document.getElementById('exportBackup')?.addEventListener('click', exportBackup);
document.getElementById('printReport')?.addEventListener('click', () => window.print());
document.getElementById('importBackupBtn')?.addEventListener('click', () => document.getElementById('importBackupFile').click());
document.getElementById('importBackupFile')?.addEventListener('change', event => { if (event.target.files?.[0]) importBackup(event.target.files[0]); event.target.value = ''; });
document.getElementById('resetDemoData')?.addEventListener('click', resetDemoData);
document.getElementById('settingsExportBackup')?.addEventListener('click', exportBackup);
document.getElementById('dangerZoneExportBackup')?.addEventListener('click', exportBackup);
document.getElementById('settingsImportBackup')?.addEventListener('click', () => document.getElementById('importBackupFile').click());
document.getElementById('importMemberUpdateBtn')?.addEventListener('click', () => document.getElementById('importMemberUpdateFile').click());
document.getElementById('importMemberUpdateFile')?.addEventListener('change', event => { if (event.target.files?.[0]) importMemberDataUpdate(event.target.files[0]); event.target.value = ''; });
document.getElementById('deleteAllSiteData')?.addEventListener('click', deleteAllSiteData);
document.getElementById('applyBulkRosterAction')?.addEventListener('click', applyBulkRosterAction);
document.getElementById('selectAllVisibleRoster')?.addEventListener('click', () => { getRosterFilteredMembers().forEach(member => bulkSelectedMemberIds.add(member.id)); renderSettings(); });
document.getElementById('clearRosterSelection')?.addEventListener('click', () => { bulkSelectedMemberIds.clear(); renderSettings(); });
document.getElementById('rosterHeaderCheckbox')?.addEventListener('change', event => { getRosterFilteredMembers().forEach(member => event.target.checked ? bulkSelectedMemberIds.add(member.id) : bulkSelectedMemberIds.delete(member.id)); renderSettings(); });
document.getElementById('rosterTableBody')?.addEventListener('change', event => { const input = event.target.closest('[data-roster-select]'); if (!input) return; input.checked ? bulkSelectedMemberIds.add(input.dataset.rosterSelect) : bulkSelectedMemberIds.delete(input.dataset.rosterSelect); renderSettings(); });

// Universal event delegation for dynamic content.
document.addEventListener('click', event => {
  const target = event.target.closest('button, [data-member-view], [data-member-care], [data-shepherd-open], [data-assign-shepherd], [data-history-open], [data-convert-visitor], [data-remove-today-visitor], [data-edit-member], [data-delete-member], [data-change-member-status], [data-archive-visitor], [data-restore-visitor], [data-delete-visitor], [data-program-open], [data-program-edit], [data-program-toggle], [data-program-attendance], [data-semester-edit], [data-semester-current], [data-semester-toggle], [data-modal-cancel]');
  if (!target) return;

  if (target.matches('[data-modal-cancel]')) return closeModal();
  if (target.dataset.memberView) return openMemberProfile(target.dataset.memberView);
  if (target.dataset.memberCare) return openCareAction(target.dataset.memberCare);
  if (target.dataset.shepherdOpen) return openShepherdGroup(target.dataset.shepherdOpen);
  if (target.dataset.assignShepherd) return openAssignMember(target.dataset.assignShepherd);
  if (target.dataset.historyOpen) return openHistoryRecord(target.dataset.historyOpen);
  if (target.dataset.convertVisitor) return convertVisitorToMember(target.dataset.convertVisitor);
  if (target.dataset.editMember) return openMemberForm(target.dataset.editMember);
  if (target.dataset.deleteMember) return deleteMember(target.dataset.deleteMember);
  if (target.dataset.changeMemberStatus) return openMemberRosterStatusForm(target.dataset.changeMemberStatus);
  if (target.dataset.archiveVisitor) return archiveVisitor(target.dataset.archiveVisitor);
  if (target.dataset.restoreVisitor) return restoreVisitor(target.dataset.restoreVisitor);
  if (target.dataset.deleteVisitor) return deleteVisitorPermanently(target.dataset.deleteVisitor);
  if (target.dataset.programOpen) return openProgramDetails(target.dataset.programOpen);
  if (target.dataset.programEdit) return openSpecialProgramForm(target.dataset.programEdit);
  if (target.dataset.programToggle) return toggleProgramArchive(target.dataset.programToggle);
  if (target.dataset.programAttendance) return startAttendanceForProgram(target.dataset.programAttendance);
  if (target.dataset.semesterEdit) return openSemesterForm(target.dataset.semesterEdit);
  if (target.dataset.semesterCurrent) return setCurrentSemester(target.dataset.semesterCurrent);
  if (target.dataset.semesterToggle) return toggleSemesterArchive(target.dataset.semesterToggle);
  if (target.dataset.removeTodayVisitor) {
    attendanceDraft.visitorIds.delete(target.dataset.removeTodayVisitor);
    renderAttendance();
  }
});

document.getElementById('modalClose')?.addEventListener('click', closeModal);
modalBackdrop?.addEventListener('click', event => { if (event.target === modalBackdrop) closeModal(); });
document.addEventListener('keydown', event => {
  if (event.key !== 'Escape') return;
  if (!modalBackdrop.hidden) closeModal();
  else if (sidebar?.classList.contains('open')) setMobileMenuOpen(false);
});

// Initial page and render.
renderFilterOptions();
loadAttendanceDraft();

document.getElementById('classificationSearch')?.addEventListener('input', renderClassification);
document.getElementById('classificationZoneFilter')?.addEventListener('change', renderClassification);

if (document.readyState === 'complete') finishOpeningScreen();
else window.addEventListener('load', finishOpeningScreen, { once: true });
window.setTimeout(finishOpeningScreen, 1500);

bootstrapSupabaseApp();
window.setTimeout(() => checkProgramReminders(), 2500);
window.setInterval(() => checkProgramReminders(), 60000);
const initialPage = window.location.hash.replace('#', '');
if (initialPage && document.getElementById(`page-${initialPage}`)) switchPage(initialPage);
document.body.dataset.appReady = 'true';
