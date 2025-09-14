'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Dumbbell, ClipboardList, ShieldCheck, LineChart, Clock, Play, Save, Upload, Download, Trash2, ChevronLeft, Plus } from 'lucide-react';
import { motion } from 'framer-motion';
import { LineChart as RLineChart, Line, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type SetEntry = { reps: number | ''; weight: number | ''; done?: boolean };
type Exercise = { id: string; name: string; isMain?: boolean; target: string; superset?: string; defaultSets: number; defaultReps: string; };
type WorkoutTemplate = { id: string; title: string; exercises: Exercise[]; };
type WorkoutLog = { id: string; date: string; templateId: string; notes?: string; entries: { exerciseId: string; sets: SetEntry[]; notes?: string; }[]; };

const TEMPLATES: WorkoutTemplate[] = [
  {
    id: 'push',
    title: 'Day 1 · Push',
    exercises: [
      { id: 'db-bench', name: 'Dumbbell Bench Press', isMain: true, target: 'chest', defaultSets: 4, defaultReps: '8–10' },
      { id: 'db-shoulder-press', name: 'Dumbbell Shoulder Press', target: 'shoulders', superset: 'A', defaultSets: 3, defaultReps: '10–12' },
      { id: 'db-lateral-raise', name: 'Dumbbell Lateral Raise', target: 'medial delts', superset: 'A', defaultSets: 3, defaultReps: '12–15' },
      { id: 'db-incline-press', name: 'Incline Dumbbell Press', target: 'upper chest', superset: 'B', defaultSets: 3, defaultReps: '8–10' },
      { id: 'db-oh-tri', name: 'Overhead Triceps Extension', target: 'triceps', superset: 'B', defaultSets: 3, defaultReps: '10–12' },
    ],
  },
  {
    id: 'pull',
    title: 'Day 2 · Pull',
    exercises: [
      { id: 'db-row', name: 'Bent-over Dumbbell Row', isMain: true, target: 'lats/mid-back', defaultSets: 4, defaultReps: '8–10' },
      { id: 'renegade-row', name: 'Renegade Row', target: 'core/back', superset: 'A', defaultSets: 3, defaultReps: '8–10' },
      { id: 'reverse-fly', name: 'Reverse Fly', target: 'rear delts', superset: 'A', defaultSets: 3, defaultReps: '12–15' },
      { id: 'curl', name: 'Biceps Curl', target: 'biceps', superset: 'B', defaultSets: 3, defaultReps: '10–12' },
      { id: 'hammer', name: 'Hammer Curl', target: 'brachioradialis', superset: 'B', defaultSets: 3, defaultReps: '10–12' },
    ],
  },
  {
    id: 'legs',
    title: 'Day 3 · Legs & Core',
    exercises: [
      { id: 'goblet-squat', name: 'Goblet Squat', isMain: true, target: 'quads/glutes', defaultSets: 4, defaultReps: '8–10' },
      { id: 'rdl', name: 'Romanian Deadlift', target: 'hamstrings', superset: 'A', defaultSets: 3, defaultReps: '8–10' },
      { id: 'side-bend', name: 'Side Bend', target: 'obliques', superset: 'A', defaultSets: 3, defaultReps: '12–15' },
      { id: 'lunge', name: 'Dumbbell Lunge', target: 'quads/glutes', superset: 'B', defaultSets: 3, defaultReps: '10–12' },
      { id: 'russian-twist', name: 'Russian Twist (per side)', target: 'core', superset: 'B', defaultSets: 3, defaultReps: '20' },
    ],
  },
];

const uid = () => Math.random().toString(36).slice(2, 10);
const STORAGE_KEY = 'pump-tracker-v1';

function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try { const raw = localStorage.getItem(key); return raw ? (JSON.parse(raw) as T) : initial; } catch { return initial; }
  });
  useEffect(() => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} }, [key, value]);
  return [value, setValue] as const;
}

function formatDate(d: string | Date) {
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: '2-digit' });
}

function kg(n: number | '') { return n === '' ? '' : `${n} kg`; }
function calcVolume(sets: SetEntry[]) { return sets.reduce((acc, s) => acc + (Number(s.reps || 0) * Number(s.weight || 0)), 0); }

export default function Page() {
  const [logs, setLogs] = useLocalStorage<WorkoutLog[]>(STORAGE_KEY, []);
  const [active, setActive] = useState<'push' | 'pull' | 'legs'>('push');
  const currentTemplate = useMemo(() => TEMPLATES.find(t => t.id === active)!, [active]);

  const [working, setWorking] = useState(false);
  const [draft, setDraft] = useState<WorkoutLog | null>(null);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<number | null>(null);
  const [profile, setProfile] = useLocalStorage<Record<string, { lastWeight?: number; note?: string }>>('pump-tracker-profile', {});

  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState('');
  const [showSettings, setShowSettings] = useState(false);

  const startWorkout = () => {
    const newDraft: WorkoutLog = {
      id: uid(),
      date: new Date().toISOString(),
      templateId: currentTemplate.id,
      notes: '',
      entries: currentTemplate.exercises.map(ex => ({
        exerciseId: ex.id,
        sets: Array.from({ length: ex.defaultSets }).map(() => ({
          reps: '',
          weight: profile[ex.id]?.lastWeight ?? '',
          done: false,
        })),
        notes: profile[ex.id]?.note || '',
      })),
    };
    setDraft(newDraft);
    setWorking(true);
  };

  const stopWorkout = () => { setWorking(false); setDraft(null); };

  const saveWorkout = () => {
    if (!draft) return;
    const updatedProfile = { ...profile };
    draft.entries.forEach(e => {
      const last = [...e.sets].reverse().find(s => s.weight !== '');
      if (last && typeof last.weight === 'number') {
        updatedProfile[e.exerciseId] = { ...updatedProfile[e.exerciseId], lastWeight: last.weight };
      }
    });
    setProfile(updatedProfile);
    setLogs([draft, ...logs]);
    setWorking(false);
    setDraft(null);
  };

  useEffect(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    if (timer > 0) {
      timerRef.current = window.setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            if (timerRef.current) window.clearInterval(timerRef.current);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [timer]);

  const adherence = useMemo(() => {
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setDate(now.getDate() - 28);
    const recent = logs.filter(l => new Date(l.date) >= fourWeeksAgo);
    const pct = Math.min(100, Math.round((recent.length / 12) * 100));
    return { completed: recent.length, expected: 12, pct };
  }, [logs]);

  const volumeSeries = useMemo(() => {
    const items = [...logs].reverse().map((l, idx) => {
      const total = l.entries.reduce((acc, e) => acc + calcVolume(e.sets), 0);
      return { idx: idx + 1, date: formatDate(l.date), volume: Math.round(total) };
    });
    return items;
  }, [logs]);

  return (
    <div className="container py-6 space-y-6">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Dumbbell className="h-7 w-7" />
          <div>
            <h1 className="text-2xl font-semibold">Three-day dumbbell programme</h1>
            <p className="text-sm muted">Hybrid plan with tracking, progression, and charts</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={() => setShowImport(true)}><Upload className="h-4 w-4" />Import</button>
          <button className="btn" onClick={() => {
            const data = JSON.stringify(logs, null, 2);
            const blob = new Blob([data], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'dumbbell-tracker-data.json'; a.click();
            URL.revokeObjectURL(url);
          }}><Download className="h-4 w-4" />Export</button>
          <button className="btn" onClick={() => setShowSettings(s => !s)}>Settings</button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><ClipboardList className="h-5 w-5" /><h2 className="font-semibold">Your plan</h2></div>
          <div className="tabs mb-3">
            {(['push','pull','legs'] as const).map(t => (
              <div key={t} className={'tab ' + (active===t?'active':'')} onClick={()=>setActive(t)}>{TEMPLATES.find(x=>x.id===t)?.title}</div>
            ))}
          </div>
          <div className="space-y-3">
            {currentTemplate.exercises.map(ex => (
              <div key={ex.id} className="p-3 rounded-xl border flex items-center justify-between">
                <div>
                  <div className="font-medium">{ex.name}</div>
                  <div className="muted mt-1 flex items-center gap-2">
                    {ex.isMain ? <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">Main</span>
                      : ex.superset ? <span className="px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-800">Superset {ex.superset}</span>
                      : null}
                    <span>{ex.target}</span>
                    <span>· {ex.defaultSets}×{ex.defaultReps}</span>
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div className="muted">Last weight</div>
                  <div className="font-medium">{kg((profile[ex.id]?.lastWeight ?? '') as any) || 'n/a'}</div>
                  <div className="mt-2"><button className="btn btn-primary" onClick={startWorkout}><Play className="h-4 w-4" />Start workout</button></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-4">
          <div className="flex items-center gap-2 mb-3"><ShieldCheck className="h-5 w-5" /><h2 className="font-semibold">Adherence (last 4 weeks)</h2></div>
          <div className="muted mb-2">{adherence.completed} of {adherence.expected} sessions</div>
          <div className="progress-wrap"><div className="progress-bar" style={{width: `${adherence.pct}%`}} /></div>
          <div className="mt-3 muted">Aim for three sessions per week. Consistency beats perfection.</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card p-4 lg:col-span-2">
          <div className="flex items-center gap-2 mb-3"><LineChart className="h-5 w-5" /><h2 className="font-semibold">Training volume</h2></div>
          <div className="h-72">
            {volumeSeries.length === 0 ? (
              <div className="h-full flex items-center justify-center muted">No data yet. Log a workout to see the chart.</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RLineChart data={volumeSeries} margin={{ left: 12, right: 12, bottom: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="volume" dot={false} />
                </RLineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        <div className="card p-4 space-y-3">
          <div className="flex items-center gap-2 mb-1"><Clock className="h-5 w-5" /><h2 className="font-semibold">Recent workouts</h2></div>
          {logs.length === 0 && <div className="muted">No workouts logged yet.</div>}
          {logs.slice(0, 6).map(l => {
            const tpl = TEMPLATES.find(t => t.id === l.templateId)!;
            const vol = l.entries.reduce((acc, e) => acc + calcVolume(e.sets), 0);
            return (
              <div key={l.id} className="border rounded-lg p-3 text-sm">
                <div className="flex items-center justify-between">
                  <div className="font-medium">{tpl.title}</div>
                  <div className="muted">{formatDate(l.date)}</div>
                </div>
                <div className="muted mt-1">Volume: {Math.round(vol)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {showSettings && (
        <div className="card p-4">
          <h3 className="font-semibold mb-2">Settings</h3>
          <div className="muted mb-2">This clears all saved workouts</div>
          <button className="btn" onClick={() => {
            if (confirm('This will delete all saved workouts. Are you sure?')) setLogs([]);
          }}><Trash2 className="h-4 w-4" />Clear workouts</button>
        </div>
      )}

      {showImport && (
        <div className="modal-backdrop" onClick={() => setShowImport(false)}>
          <div className="modal" onClick={(e)=>e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Import data</h3>
            <textarea className="input min-h-40" placeholder="Paste JSON here" value={importText} onChange={(e)=>setImportText(e.target.value)} />
            <div className="mt-3 flex justify-end gap-2">
              <button className="btn" onClick={()=>setShowImport(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={()=>{
                try {
                  const parsed = JSON.parse(importText);
                  if (!Array.isArray(parsed)) throw new Error('Invalid format');
                  setLogs(parsed);
                  alert('Imported successfully');
                  setShowImport(false);
                } catch (e:any) {
                  alert('Import failed: ' + e.message);
                }
              }}><Upload className="h-4 w-4" />Apply</button>
            </div>
          </div>
        </div>
      )}

      {working && draft && (
        <motion.div initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="fixed inset-x-0 bottom-0 bg-white dark:bg-neutral-950 border-t border-neutral-200 dark:border-neutral-800 shadow-2xl">
          <div className="container py-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <button className="btn" onClick={stopWorkout}><ChevronLeft className="h-4 w-4" /></button>
                <h2 className="text-lg font-semibold">{TEMPLATES.find(t => t.id === draft.templateId)?.title} · {formatDate(draft.date)}</h2>
              </div>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={()=>setTimer(90)}><Clock className="h-4 w-4" />90s timer</button>
                <button className="btn btn-primary" onClick={saveWorkout}><Save className="h-4 w-4" />Save workout</button>
              </div>
            </div>

            {timer > 0 && (
              <div className="rounded-lg border p-3 flex items-center justify-between">
                <div className="flex items-center gap-2"><Clock className="h-4 w-4" />Rest timer</div>
                <div className="font-mono text-xl">{String(Math.floor(timer / 60)).padStart(2,'0')}:{String(timer % 60).padStart(2,'0')}</div>
              </div>
            )}

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              {draft.entries.map((entry, idx) => {
                const ex = currentTemplate.exercises.find(e => e.id === entry.exerciseId)!;
                const isSuperset = Boolean(ex.superset);
                return (
                  <div key={ex.id} className="card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-base font-semibold">{ex.name}</div>
                      <div className="muted">{ex.isMain ? 'Main lift' : isSuperset ? `Superset ${ex.superset}` : 'Accessory'} · {ex.defaultSets}×{ex.defaultReps}</div>
                    </div>
                    <div className="grid grid-cols-12 gap-2 items-center">
                      <div className="col-span-2 muted">Set</div>
                      <div className="col-span-3 text-xs">Reps</div>
                      <div className="col-span-4 text-xs">Weight (kg)</div>
                      <div className="col-span-3 text-xs text-center">Done</div>
                      {entry.sets.map((s, i) => (
                        <React.Fragment key={i}>
                          <div className="col-span-2 text-sm py-1">{i + 1}</div>
                          <div className="col-span-3">
                            <input className="input" inputMode="numeric" value={s.reps as any} onChange={(e)=>{
                              const v = e.target.value === '' ? '' : Math.max(0, Number(e.target.value));
                              const newDraft = { ...draft };
                              newDraft.entries[idx].sets[i].reps = v as any;
                              setDraft(newDraft);
                            }} placeholder={ex.defaultReps} />
                          </div>
                          <div className="col-span-4">
                            <input className="input" inputMode="decimal" value={s.weight as any} onFocus={()=>{
                              if (s.weight === '' && profile[ex.id]?.lastWeight) {
                                const newDraft = { ...draft };
                                newDraft.entries[idx].sets[i].weight = profile[ex.id]?.lastWeight || '' as any;
                                setDraft(newDraft);
                              }
                            }} onChange={(e)=>{
                              const v = e.target.value === '' ? '' : Number(e.target.value);
                              const newDraft = { ...draft };
                              newDraft.entries[idx].sets[i].weight = v as any;
                              setDraft(newDraft);
                            }} placeholder={profile[ex.id]?.lastWeight ? String(profile[ex.id]?.lastWeight) : 'kg'} />
                          </div>
                          <div className="col-span-3 flex items-center justify-center">
                            <input type="checkbox" checked={!!s.done} onChange={(e)=>{
                              const newDraft = { ...draft };
                              newDraft.entries[idx].sets[i].done = e.target.checked;
                              setDraft(newDraft);
                            }} />
                          </div>
                        </React.Fragment>
                      ))}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <button className="btn" onClick={()=>{
                        const newDraft = { ...draft };
                        newDraft.entries[idx].sets.push({ reps: '', weight: profile[ex.id]?.lastWeight ?? '', done: false });
                        setDraft(newDraft);
                      }}><Plus className="h-4 w-4" />Add set</button>
                      <button className="btn" onClick={()=> setTimer(ex.isMain ? 90 : 60)}><Clock className="h-4 w-4" />{ex.isMain ? '90s' : '60s'} rest</button>
                    </div>
                    <div className="mt-2">
                      <div className="label mb-1">Notes</div>
                      <textarea className="input" value={entry.notes || ''} onChange={(e)=>{
                        const newDraft = { ...draft };
                        newDraft.entries[idx].notes = e.target.value;
                        setDraft(newDraft);
                      }} placeholder="Cues, tempo, pinched shoulder, etc." />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <div className="muted">Your data are saved locally in your browser.</div>
              <div className="flex items-center gap-2">
                <button className="btn" onClick={stopWorkout}><ChevronLeft className="h-4 w-4" />Cancel</button>
                <button className="btn btn-primary" onClick={saveWorkout}><Save className="h-4 w-4" />Save workout</button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      <footer className="pt-8 pb-20 text-center text-xs muted">Built for a three-day hybrid plan. British English spelling. No em dashes.</footer>
    </div>
  );
}
