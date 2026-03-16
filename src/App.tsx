import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
  Camera, 
  History, 
  Settings, 
  UserCheck, 
  AlertCircle, 
  CheckCircle2, 
  XCircle, 
  Info, 
  Smartphone, 
  ShieldCheck,
  Trash2,
  ChevronDown,
  ChevronUp,
  Volume2,
  VolumeX,
  Vibrate,
  Clock,
  Download,
  Users
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { QRCodeSVG } from 'qrcode.react';
import { toJpeg } from 'html-to-image';
import { Scanner } from './components/Scanner';
import { ScannerConfig, MemberProfile, LogEntry, ScanStatus, Qualification } from './types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const THEME_WORDS = ['TANNE', 'HIRSCH', 'KUCKUCK', 'BAECHLE', 'WALD', 'SAUNA', 'AUFGUSS', 'BANJA', 'WENIK', 'GLUT', 'DAMPF', 'ZAPFEN', 'LUCHS', 'FUCHS', 'SPECHT', 'MUEHLE', 'SCHWARZWALD', 'WICHTEL'];

const DEFAULT_CONFIG: ScannerConfig = {
  apiUrl: '',
  apiToken: '',
  deviceName: 'Scanner 1',
  codePattern: '^[A-Za-z0-9_-]{4,40}$',
  dedupeMs: 3000,
  soundEnabled: true,
  vibrationEnabled: true,
  autoHideEnabled: true,
  adminCode: '001-fds',
};

const QUALIFICATION_ICONS: Record<Qualification, { label: string; color: string; icon: string }> = {
  grundkurs: { label: 'Grundkurs', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30', icon: '📜' },
  vertiefung: { label: 'Vertiefung', color: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30', icon: '📚' },
  saunameister: { label: 'Saunameister', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30', icon: '👑' },
  banja: { label: 'Banja', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30', icon: '🌿' },
  raeuchern: { label: 'Räuchern', color: 'bg-orange-500/20 text-orange-400 border-orange-500/30', icon: '💨' },
  menthol: { label: 'Menthol', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30', icon: '❄️' },
  kraeuter: { label: 'Kräutersud', color: 'bg-lime-500/20 text-lime-400 border-lime-500/30', icon: '🍵' },
  peeling: { label: 'Peeling', color: 'bg-rose-500/20 text-rose-400 border-rose-500/30', icon: '✨' },
};

export default function App() {
  const qrCardRef = useRef<HTMLDivElement>(null);
  // State
  const [config, setConfig] = useState<ScannerConfig>(() => {
    const saved = localStorage.getItem('sauna-scanner-config');
    return saved ? JSON.parse(saved) : DEFAULT_CONFIG;
  });
  
  const [logs, setLogs] = useState<LogEntry[]>(() => {
    const saved = localStorage.getItem('sauna-scanner-logs');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [lastProfile, setLastProfile] = useState<MemberProfile | null>(() => {
    const saved = localStorage.getItem('sauna-scanner-profile');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [view, setView] = useState<'scanner' | 'member' | 'admin'>('scanner');
  const [isScanning, setIsScanning] = useState(true);
  const [scanStatus, setScanStatus] = useState<ScanStatus>('idle');
  const [statusMessage, setStatusMessage] = useState({ title: 'Bereit', sub: 'Scanner aktiv' });
  const [familyPromptCode, setFamilyPromptCode] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [feedbackAnswers, setFeedbackAnswers] = useState<Record<string, any>>({});
  const [lastInteraction, setLastInteraction] = useState(Date.now());
  
  // Admin specific state
  const [allMembers, setAllMembers] = useState<MemberProfile[]>([]);
  const [editingMember, setEditingMember] = useState<MemberProfile | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [backgroundDataUrl, setBackgroundDataUrl] = useState<string | null>(null);
  const [dailyCodes, setDailyCodes] = useState<Record<string, any>>({});
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [generatedGuestCode, setGeneratedGuestCode] = useState<string | null>(null);
  const [generatedMemberCode, setGeneratedMemberCode] = useState<string | null>(null);
  
  // Date states for daily codes
  const [memberCodeValidFrom, setMemberCodeValidFrom] = useState<string>('');
  const [memberCodeValidUntil, setMemberCodeValidUntil] = useState<string>('');
  const [guestCodeValidFrom, setGuestCodeValidFrom] = useState<string>('');
  const [guestCodeValidUntil, setGuestCodeValidUntil] = useState<string>('');
  
  const lastScanRef = useRef<{ code: string; time: number }>({ code: '', time: 0 });
  const audioContextRef = useRef<AudioContext | null>(null);

  // Fetch background as base64 to avoid CORS issues with html-to-image
  useEffect(() => {
    // Load background image
    fetch('https://ftp.sauna-fds.de/bilder/saunafreunde-scaner.jpg')
      .then(res => res.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onloadend = () => setBackgroundDataUrl(reader.result as string);
        reader.readAsDataURL(blob);
      })
      .catch(err => console.error('Failed to load background', err));
  }, []);

  // Persistence
  useEffect(() => {
    localStorage.setItem('sauna-scanner-config', JSON.stringify(config));
  }, [config]);

  useEffect(() => {
    localStorage.setItem('sauna-scanner-logs', JSON.stringify(logs));
  }, [logs]);

  useEffect(() => {
    localStorage.setItem('sauna-scanner-profile', JSON.stringify(lastProfile));
  }, [lastProfile]);

  // Auto-close member view after 20 seconds of inactivity
  useEffect(() => {
    if (view === 'member') {
      const timeout = setTimeout(() => {
        setView('scanner');
        setLastProfile(null);
        setIsScanning(true);
      }, 20000);
      return () => clearTimeout(timeout);
    }
  }, [view, lastInteraction]);

  // Fetch config and members when entering admin view
  const [membersLoaded, setMembersLoaded] = useState(false);
  
  useEffect(() => {
    if (view === 'admin' && !membersLoaded) {
      // Fetch Config
      fetch('/api/config')
        .then(res => res.json())
        .then(data => {
          setConfig(prev => ({ ...prev, ...data }));
        })
        .catch(err => console.error('Failed to fetch config', err));

      // Fetch Members
      fetch('/api/members')
        .then(res => res.json())
        .then(data => {
          const normalized = data.map((m: any) => ({
            code: m.code,
            memberNumber: m.member_number,
            memberName: m.name,
            memberStatus: m.status,
            present: !!m.present,
            visits30: m.visits_30_days,
            visits365: m.visits_365_days,
            visitsTotal: m.visits_total,
            warning: m.warning,
            autoCheckoutInfo: !!m.auto_checkout_info,
            isAdmin: !!m.is_admin,
            isFamily: !!m.is_family,
            qualifications: m.qualifications || [],
            feedbackQuestions: m.feedback_questions || [],
          }));
          setAllMembers(normalized);
          setMembersLoaded(true);
        })
        .catch(err => console.error('Failed to fetch members', err));

      // Fetch Daily Codes
      fetch('/api/daily-codes')
        .then(res => res.json())
        .then(data => setDailyCodes(data))
        .catch(err => console.error('Failed to fetch daily codes', err));
    }
  }, [view]);

  // Audio/Haptic Feedback
  const playFeedback = useCallback((type: 'success' | 'warn' | 'error') => {
    if (config.soundEnabled) {
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        }
        const ctx = audioContextRef.current;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        const freq = type === 'success' ? 880 : type === 'warn' ? 440 : 220;
        const duration = type === 'success' ? 0.1 : 0.2;
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {
        console.error('Audio feedback error', e);
      }
    }
    
    if (config.vibrationEnabled && 'vibrate' in navigator) {
      if (type === 'success') navigator.vibrate(50);
      else if (type === 'warn') navigator.vibrate([50, 30, 50]);
      else navigator.vibrate([100, 50, 100]);
    }
  }, [config.soundEnabled, config.vibrationEnabled]);

  // Scan Logic
  const handleScan = useCallback(async (code: string, familyCount?: number) => {
    if (isSending) return;
    
    const now = Date.now();
    if (familyCount === undefined && code === lastScanRef.current.code && now - lastScanRef.current.time < config.dedupeMs) {
      return;
    }
    
    lastScanRef.current = { code, time: now };

    // Admin Notfall Code Bypass
    if (code === 'admin123456789') {
      const profile: MemberProfile = {
        code: 'admin123456789',
        memberNumber: 'ADMIN-EMERGENCY',
        memberName: 'Notfall Admin',
        memberStatus: 'aktiv',
        present: false,
        visits30: 0,
        visits365: 0,
        visitsTotal: 0,
        warning: '',
        autoCheckoutInfo: false,
        isAdmin: true,
        qualifications: [],
        feedbackQuestions: [],
      };
      setLastProfile(profile);
      playFeedback('success');
      setView('admin');
      setIsScanning(false);
      return;
    }
    
    // Pattern validation
    const pattern = new RegExp(config.codePattern);
    if (!pattern.test(code)) {
      playFeedback('error');
      setScanStatus('error');
      setStatusMessage({ title: 'Ungültiges Format', sub: 'Der Code entspricht nicht dem Muster' });
      addLog(code, 'Ungültiges Kartenformat', 'error');
      return;
    }

    setIsSending(true);
    setScanStatus('sending');
    setStatusMessage({ title: 'Übertrage...', sub: `Code: ${code}` });

    try {
      // Mock API call (using our server.ts endpoint)
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiToken || 'test-token'}`,
          'X-Device-Name': encodeURIComponent(config.deviceName),
        },
        body: JSON.stringify({
          ausweis_nr: code,
          aktion: 'einlass',
          device_name: config.deviceName,
          scanned_at: new Date().toISOString(),
          family_count: familyCount,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.needs_family_count) {
        setFamilyPromptCode(code);
        setIsSending(false);
        return;
      }

      // Normalize data
      const profile: MemberProfile = {
        code,
        memberNumber: data.member_number || 'FDS-XXX',
        memberName: data.name || 'Unbekannt',
        memberStatus: data.status || 'aktiv',
        present: !!data.present,
        visits30: data.visits_30_days || 0,
        visits365: data.visits_365_days || 0,
        visitsTotal: data.visits_total || 0,
        warning: data.warning || '',
        autoCheckoutInfo: !!data.auto_checkout_info,
        isAdmin: !!data.is_admin,
        isFamily: !!data.is_family,
        qualifications: data.qualifications || [],
        feedbackQuestions: data.feedback_questions || [],
        checkoutMessage: data.checkout_message,
      };

      setLastProfile(profile);
      
      if (profile.isAdmin) {
        playFeedback('success');
        setView('admin');
        setIsScanning(false);
      } else {
        playFeedback(profile.present ? 'warn' : 'success');
        setView('member');
        setIsScanning(false);
      }

      addLog(code, `Scan erfolgreich: ${profile.memberName}`, profile.present ? 'warn' : 'success');

    } catch (error) {
      playFeedback('error');
      setScanStatus('error');
      setStatusMessage({ title: 'Fehler', sub: error instanceof Error ? error.message : 'Unbekannter Fehler' });
      addLog(code, `Fehler: ${error instanceof Error ? error.message : 'Unbekannt'}`, 'error');
    } finally {
      setIsSending(false);
    }
  }, [config, isSending, playFeedback]);

  const addLog = (code: string, message: string, kind: LogEntry['kind']) => {
    const newEntry: LogEntry = {
      id: Math.random().toString(36).substring(2, 9),
      code,
      message,
      kind,
      time: new Date().toLocaleTimeString('de-DE'),
      isoTime: new Date().toISOString(),
    };
    setLogs(prev => [newEntry, ...prev].slice(0, 50));
  };

  const clearLogs = () => {
    if (confirm('Möchten Sie das Protokoll wirklich leeren?')) {
      setLogs([]);
    }
  };

  const resetToScanner = async () => {
    // Save config to server before leaving admin view
    if (view === 'admin') {
      try {
        await fetch('/api/config', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            apiUrl: config.apiUrl,
            deviceName: config.deviceName,
            soundEnabled: config.soundEnabled,
            feedbackQuestions: config.feedbackQuestions
          })
        });
      } catch (err) {
        console.error('Failed to save config to server', err);
      }
    }

    // Submit feedback if any
    if (view === 'member' && lastProfile && Object.keys(feedbackAnswers).length > 0) {
      try {
        await fetch('/api/members/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            code: lastProfile.code,
            answers: feedbackAnswers
          })
        });
      } catch (err) {
        console.error('Failed to save feedback', err);
      }
    }

    setView('scanner');
    setIsScanning(true);
    setScanStatus('idle');
    setStatusMessage({ title: 'Bereit', sub: 'Scanner aktiv' });
    setFeedbackAnswers({});
    setEditingMember(null);
  };

  const updateMemberOnServer = async () => {
    if (!editingMember) return;
    setIsUpdating(true);
    try {
      const endpoint = editingMember.isNew ? '/api/members/create' : '/api/members/update';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: editingMember.code,
          name: editingMember.memberName,
          qualifications: editingMember.qualifications,
          is_admin: editingMember.isAdmin,
          is_family: editingMember.isFamily
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (editingMember.isNew) {
          // Create new member - use returned data
          const newMember: MemberProfile = {
            code: data.member.code,
            memberNumber: data.member.member_number,
            memberName: data.member.name,
            memberStatus: data.member.status,
            present: data.member.present,
            visits30: data.member.visits_30_days,
            visits365: data.member.visits_365_days,
            visitsTotal: data.member.visits_total,
            warning: data.member.warning,
            autoCheckoutInfo: data.member.auto_checkout_info,
            isAdmin: data.member.is_admin,
            isFamily: data.member.is_family,
            qualifications: data.member.qualifications,
            feedbackQuestions: data.member.feedback_questions
          };
          setAllMembers(prev => [...prev, newMember]);
          setEditingMember(null);
          alert('Mitglied erfolgreich angelegt');
        } else {
          // Update existing member - reload full list from server to ensure consistency
          const refreshRes = await fetch('/api/members');
          if (refreshRes.ok) {
            const membersData = await refreshRes.json();
            const normalized = membersData.map((m: any) => ({
              code: m.code,
              memberNumber: m.member_number,
              memberName: m.name,
              memberStatus: m.status,
              present: m.present,
              visits30: m.visits_30_days,
              visits365: m.visits_365_days,
              visitsTotal: m.visits_total,
              warning: m.warning,
              autoCheckoutInfo: m.auto_checkout_info,
              isAdmin: m.is_admin,
              isFamily: m.is_family,
              qualifications: m.qualifications,
              feedbackQuestions: m.feedback_questions
            }));
            setAllMembers(normalized);
            setEditingMember(null);
            alert('Mitglied erfolgreich aktualisiert');
          }
        }
      } else {
        const errorData = await res.json();
        alert(`Fehler: ${errorData.error || 'Unbekannter Fehler'}`);
      }
    } catch (err) {
      console.error('Update failed', err);
      alert('Fehler beim Speichern');
    } finally {
      setIsUpdating(false);
    }
  };

  const generateDailyCode = async (type: 'member' | 'guest', ref: string, validFrom?: string, validUntil?: string) => {
    setIsGeneratingCode(true);
    try {
      const res = await fetch('/api/daily-codes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, ref, validFrom, validUntil })
      });
      if (res.ok) {
        const data = await res.json();
        setDailyCodes(prev => ({ ...prev, [data.code]: data }));
        if (type === 'guest') {
          setGeneratedGuestCode(data.code);
        } else {
          setGeneratedMemberCode(data.code);
        }
      }
    } catch (err) {
      console.error('Failed to generate daily code', err);
      alert('Fehler beim Generieren des Codes');
    } finally {
      setIsGeneratingCode(false);
    }
  };

  const toggleQualification = (q: Qualification) => {
    if (!editingMember) return;
    const current = editingMember.qualifications;
    const next = current.includes(q) 
      ? current.filter(item => item !== q) 
      : [...current, q];
    setEditingMember({ ...editingMember, qualifications: next });
  };

  return (
    <div className="min-h-screen p-4 md:p-8 font-sans selection:bg-moss-500/30">
      {/* Background Elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-moss-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-wood-500/10 rounded-full blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        <AnimatePresence mode="wait">
          {familyPromptCode && (
            <motion.div
              key="family-prompt"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-forest-950/80 backdrop-blur-sm"
            >
              <div className="glass rounded-[40px] p-8 md:p-12 shadow-2xl max-w-md w-full text-center space-y-8">
                <div>
                  <h2 className="text-3xl font-black tracking-tight text-cream-100 mb-2">Familienmitgliedschaft</h2>
                  <p className="text-cream-100/60">Wie viele Familienmitglieder sind heute dabei?</p>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {[1, 2, 3, 4, 5, 6].map(num => (
                    <button
                      key={num}
                      onClick={() => {
                        const code = familyPromptCode;
                        setFamilyPromptCode(null);
                        handleScan(code, num);
                      }}
                      className="h-16 rounded-2xl bg-white/5 border border-white/10 text-2xl font-black text-cream-100 hover:bg-moss-500/20 hover:text-moss-500 hover:border-moss-500/50 transition-all"
                    >
                      {num}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setFamilyPromptCode(null)}
                  className="w-full py-4 rounded-2xl bg-white/5 text-cream-100/60 font-bold hover:bg-white/10 transition-colors"
                >
                  Abbrechen
                </button>
              </div>
            </motion.div>
          )}

          {view === 'scanner' && (
            <motion.div
              key="scanner-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8"
            >
              <header className="text-center space-y-4">
                <div className="w-full h-24 md:h-32 mb-8 flex justify-center">
                  <img src="/logo.jpg" alt="Logo" className="h-full max-w-[200px] md:max-w-[300px] object-contain" />
                </div>
              </header>

              <div className="rounded-[40px] p-8 md:p-12 shadow-2xl relative overflow-hidden" 
                style={{ backgroundImage: `url(${backgroundDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }}>
                <div className="absolute inset-0 bg-forest-950/20 backdrop-blur-sm" />
                
                <div className="relative space-y-8">
                  <div className={cn(
                    "rounded-3xl p-6 border transition-all duration-300 flex items-center gap-6",
                    scanStatus === 'idle' && "bg-white/5 border-white/10",
                    scanStatus === 'sending' && "bg-wood-500/10 border-wood-500/30",
                    scanStatus === 'error' && "bg-red-500/20 border-red-500/40",
                  )}>
                    <div className={cn(
                      "w-16 h-16 rounded-full flex items-center justify-center border-2 shrink-0",
                      scanStatus === 'idle' && "border-white/10 bg-white/5",
                      scanStatus === 'sending' && "border-wood-500/30 bg-wood-500/20",
                      scanStatus === 'error' && "border-red-500/40 bg-red-500/30",
                    )}>
                      {scanStatus === 'idle' && <Camera className="w-8 h-8 text-white/20" />}
                      {scanStatus === 'sending' && <div className="w-8 h-8 border-2 border-wood-500 border-t-transparent rounded-full animate-spin" />}
                      {scanStatus === 'error' && <XCircle className="w-10 h-10 text-red-500" />}
                    </div>
                    <div>
                      <h3 className="text-xl font-black tracking-tight">{statusMessage.title}</h3>
                      <p className="text-cream-100/60 font-medium">{statusMessage.sub}</p>
                    </div>
                  </div>

                  <Scanner isScanning={isScanning} onScan={handleScan} />

                  <div className="pt-4">
                    <input 
                      type="text" 
                      placeholder="Manueller Code..."
                      className="w-full bg-forest-950/50 border border-white/10 rounded-2xl px-6 py-4 text-center font-bold tracking-widest focus:outline-none focus:border-moss-500/50 transition-all"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleScan((e.target as HTMLInputElement).value);
                          (e.target as HTMLInputElement).value = '';
                        }
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'member' && lastProfile && (
            <motion.div
              key="member-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-6"
              onPointerDown={() => setLastInteraction(Date.now())}
            >
              <div className="glass rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-moss-500/10 to-transparent pointer-events-none" />
                
                <div className="relative space-y-8">
                  {lastProfile.checkoutMessage ? (
                    <div className="text-center space-y-6 py-12">
                      <div className="w-24 h-24 bg-moss-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <span className="text-5xl">👋</span>
                      </div>
                      <h2 className="text-4xl font-black tracking-tight text-cream-100">{lastProfile.checkoutMessage}</h2>
                      <p className="text-cream-100/60 font-medium text-lg">Bis zum nächsten Mal, {lastProfile.memberName}!</p>
                    </div>
                  ) : (
                    <>
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-moss-500">Mitglied erkannt</p>
                          <h2 className="text-4xl font-black tracking-tight text-cream-100">{lastProfile.memberName}</h2>
                          <div className="flex items-center gap-3">
                            <span className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-xs font-mono font-bold text-cream-100/40">
                              {lastProfile.memberNumber}
                            </span>
                            <span className={cn(
                              "px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest",
                              "bg-green-500/20 text-green-500"
                            )}>
                              Eingecheckt
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-end">
                          {lastProfile.qualifications.map(q => (
                            <div 
                              key={q} 
                              title={QUALIFICATION_ICONS[q].label}
                              className={cn(
                                "w-12 h-12 rounded-2xl flex items-center justify-center border-2 text-xl shadow-lg transition-transform hover:scale-110 cursor-help",
                                QUALIFICATION_ICONS[q].color
                              )}
                            >
                              {QUALIFICATION_ICONS[q].icon}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        {[
                          { label: '30 Tage', value: lastProfile.visits30 },
                          { label: '12 Monate', value: lastProfile.visits365 },
                          { label: 'Gesamt', value: lastProfile.visitsTotal },
                        ].map((m, i) => (
                          <div key={i} className="glass rounded-3xl p-6 text-center border-white/5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-cream-100/30 mb-2">{m.label}</p>
                            <p className="text-3xl font-black text-cream-100">{m.value}</p>
                          </div>
                        ))}
                      </div>

                      {lastProfile.warning && (
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-3xl p-6 flex gap-4">
                          <AlertCircle className="w-6 h-6 text-amber-500 shrink-0" />
                          <p className="text-amber-200/80 font-medium leading-relaxed">{lastProfile.warning}</p>
                        </div>
                      )}

                      {lastProfile.feedbackQuestions.length > 0 && (
                        <div className="space-y-4 pt-4 border-t border-white/5">
                          <h4 className="text-sm font-black uppercase tracking-widest text-cream-100/30 flex items-center gap-2">
                            <Info className="w-4 h-4" />
                            Rückmeldung erforderlich
                          </h4>
                          <div className="space-y-4">
                            {lastProfile.feedbackQuestions.map(q => (
                              <div key={q.id} className="space-y-2">
                                <p className="text-sm font-bold text-cream-100/80">{q.text}</p>
                                {q.type === 'yes_no' && (
                                  <div className="flex gap-2">
                                    {['Ja', 'Nein'].map(opt => (
                                      <button
                                        key={opt}
                                        onClick={() => setFeedbackAnswers(prev => ({ ...prev, [q.id]: opt }))}
                                        className={cn(
                                          "flex-1 px-6 py-3 rounded-xl text-sm font-bold border transition-all",
                                          feedbackAnswers[q.id] === opt 
                                            ? (opt === 'Ja' ? "bg-moss-500 border-moss-500 text-white" : "bg-red-500 border-red-500 text-white") 
                                            : "bg-white/5 border-white/10 text-cream-100/60 hover:bg-white/10"
                                        )}
                                      >
                                        {opt}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                {q.type === 'event' && (
                                  <div className="space-y-4 bg-white/5 p-5 rounded-2xl border border-white/10">
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-cream-100/40 uppercase tracking-widest">Kommt ab</label>
                                        <input 
                                          type="time" 
                                          className="w-full bg-forest-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-moss-500/50"
                                          value={feedbackAnswers[q.id]?.start || ''}
                                          onChange={(e) => setFeedbackAnswers(prev => ({ 
                                            ...prev, 
                                            [q.id]: { ...(prev[q.id] || {}), start: e.target.value } 
                                          }))}
                                        />
                                      </div>
                                      <div className="space-y-2">
                                        <label className="text-[10px] font-bold text-cream-100/40 uppercase tracking-widest">Geht um</label>
                                        <input 
                                          type="time" 
                                          className="w-full bg-forest-950 border border-white/10 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-moss-500/50"
                                          value={feedbackAnswers[q.id]?.end || ''}
                                          onChange={(e) => setFeedbackAnswers(prev => ({ 
                                            ...prev, 
                                            [q.id]: { ...(prev[q.id] || {}), end: e.target.value } 
                                          }))}
                                        />
                                      </div>
                                    </div>
                                    <label className="flex items-center gap-3 cursor-pointer group">
                                      <div className={cn(
                                        "w-6 h-6 rounded-lg border flex items-center justify-center transition-all",
                                        feedbackAnswers[q.id]?.gastro ? "bg-moss-500 border-moss-500" : "bg-forest-950 border-white/10 group-hover:border-white/30"
                                      )}>
                                        {feedbackAnswers[q.id]?.gastro && <CheckCircle2 className="w-4 h-4 text-white" />}
                                      </div>
                                      <span className="text-sm font-bold text-cream-100/80">Gastro Unterstützung</span>
                                      <input 
                                        type="checkbox" 
                                        className="hidden"
                                        checked={feedbackAnswers[q.id]?.gastro || false}
                                        onChange={(e) => setFeedbackAnswers(prev => ({ 
                                          ...prev, 
                                          [q.id]: { ...(prev[q.id] || {}), gastro: e.target.checked } 
                                        }))}
                                      />
                                    </label>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  <button
                    onClick={resetToScanner}
                    className="w-full py-5 rounded-3xl bg-moss-500 text-white font-black text-lg shadow-xl shadow-moss-500/20 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Fertig & Schließen
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {view === 'admin' && (
            <motion.div
              key="admin-view"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              <div className="glass rounded-[40px] p-8 md:p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-wood-500/10 to-transparent pointer-events-none" />
                
                <div className="relative space-y-8">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-wood-500">Admin Bereich</p>
                      <h2 className="text-3xl font-black tracking-tight text-cream-100">System-Einstellungen</h2>
                    </div>
                    <button onClick={resetToScanner} className="p-3 rounded-2xl bg-white/5 border border-white/10 text-cream-100/40 hover:bg-white/10">
                      <XCircle className="w-6 h-6" />
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-cream-100/30">Scanner</h3>
                      <div className="space-y-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-cream-100/40 ml-1">Webhook URL</label>
                          <input 
                            type="text" 
                            value={config.apiUrl}
                            onChange={(e) => setConfig({ ...config, apiUrl: e.target.value })}
                            className="w-full bg-forest-950 border border-white/10 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-cream-100/40 ml-1">Gerätename</label>
                          <input 
                            type="text" 
                            value={config.deviceName}
                            onChange={(e) => setConfig({ ...config, deviceName: e.target.value })}
                            className="w-full bg-forest-950 border border-white/10 rounded-xl px-4 py-3 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-black uppercase tracking-widest text-cream-100/30">Feedback & Log</h3>
                      <div className="space-y-3">
                        <button 
                          onClick={() => setConfig({ ...config, soundEnabled: !config.soundEnabled })}
                          className={cn("w-full flex items-center justify-between p-4 rounded-2xl border transition-all", config.soundEnabled ? "bg-moss-500/10 border-moss-500/30 text-moss-500" : "bg-white/5 border-white/10 text-cream-100/30")}
                        >
                          <span className="text-sm font-bold">Signalton</span>
                          {config.soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
                        </button>
                        <button 
                          onClick={clearLogs}
                          className="w-full flex items-center justify-between p-4 rounded-2xl border border-red-500/20 bg-red-500/5 text-red-500 hover:bg-red-500/10 transition-all"
                        >
                          <span className="text-sm font-bold">Aktivitätsprotokoll leeren</span>
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-cream-100/30">Globale Rückfragen</h3>
                      <button 
                        onClick={() => {
                          const newQ = { id: `q${Date.now()}`, text: 'Neue Frage', type: 'yes_no' as const };
                          setConfig(prev => ({ ...prev, feedbackQuestions: [...(prev.feedbackQuestions || []), newQ] }));
                        }}
                        className="px-3 py-1 rounded-lg bg-moss-500/20 text-moss-500 text-xs font-bold hover:bg-moss-500/30 transition-colors"
                      >
                        + Frage hinzufügen
                      </button>
                    </div>
                    
                    <div className="space-y-3">
                      {(config.feedbackQuestions || []).map((q, idx) => (
                        <div key={q.id} className="glass p-4 rounded-2xl border-white/5 space-y-3">
                          <div className="flex gap-3">
                            <input 
                              type="text" 
                              value={q.text}
                              onChange={(e) => {
                                const newQs = [...(config.feedbackQuestions || [])];
                                newQs[idx].text = e.target.value;
                                setConfig(prev => ({ ...prev, feedbackQuestions: newQs }));
                              }}
                              className="flex-1 bg-forest-950 border border-white/10 rounded-xl px-3 py-2 text-sm"
                              placeholder="Frage Text..."
                            />
                            <select
                              value={q.type}
                              onChange={(e) => {
                                const newQs = [...(config.feedbackQuestions || [])];
                                newQs[idx].type = e.target.value as any;
                                setConfig(prev => ({ ...prev, feedbackQuestions: newQs }));
                              }}
                              className="bg-forest-950 border border-white/10 rounded-xl px-3 py-2 text-sm"
                            >
                              <option value="yes_no">Ja/Nein Frage</option>
                              <option value="event">Event Abfrage</option>
                            </select>
                            <button 
                              onClick={() => {
                                const newQs = (config.feedbackQuestions || []).filter(item => item.id !== q.id);
                                setConfig(prev => ({ ...prev, feedbackQuestions: newQs }));
                              }}
                              className="p-2 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500/20"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                      {(!config.feedbackQuestions || config.feedbackQuestions.length === 0) && (
                        <p className="text-center text-sm text-cream-100/30 py-4">Keine globalen Rückfragen konfiguriert.</p>
                      )}
                    </div>
                  </div>

                  {/* Member Management Section */}
                  <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-cream-100/30">Mitglieder-Verwaltung</h3>
                      <div className="flex items-center gap-4">
                        <span className="text-[10px] text-cream-100/20">{allMembers.length} Mitglieder geladen</span>
                        <button
                          onClick={() => {
                            const word = THEME_WORDS[Math.floor(Math.random() * THEME_WORDS.length)];
                            const num = Math.floor(Math.random() * 900) + 100;
                            setEditingMember({
                              code: `FDS-${word}-${num}`,
                              memberNumber: '',
                              memberName: '',
                              memberStatus: 'aktiv',
                              present: false,
                              visits30: 0,
                              visits365: 0,
                              visitsTotal: 0,
                              warning: '',
                              autoCheckoutInfo: false,
                              isAdmin: false,
                              qualifications: [],
                              feedbackQuestions: [],
                              isNew: true
                            });
                          }}
                          className="px-3 py-1 rounded-lg bg-moss-500/20 text-moss-500 text-xs font-bold hover:bg-moss-500/30 transition-colors"
                        >
                          + Neues Mitglied
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-[1fr_1.5fr] gap-6">
                      {/* List */}
                      <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {allMembers.map(m => (
                          <button
                            key={m.code}
                            onClick={() => setEditingMember(m)}
                            className={cn(
                              "w-full text-left p-4 rounded-2xl border transition-all",
                              editingMember?.code === m.code ? "bg-moss-500/20 border-moss-500/50" : "bg-white/5 border-white/5 hover:bg-white/10"
                            )}
                          >
                            <p className="text-xs font-black text-cream-100">{m.memberName}</p>
                            <p className="text-[10px] font-mono text-cream-100/30">{m.memberNumber}</p>
                          </button>
                        ))}
                      </div>

                      {/* Editor */}
                      <div className="glass rounded-3xl p-6 border-white/5">
                        {editingMember ? (
                          <div className="space-y-6">
                            <div className="space-y-4">
                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-cream-100/40 ml-1">Name</label>
                                <input 
                                  type="text" 
                                  value={editingMember.memberName || ''}
                                  onChange={(e) => setEditingMember({ ...editingMember, memberName: e.target.value })}
                                  className="w-full bg-black border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30"
                                />
                              </div>

                              <div className="space-y-1">
                                <label className="text-[10px] font-bold text-cream-100/40 ml-1">QR Code (Ausweis Code)</label>
                                <div className="flex gap-3">
                                  <input 
                                    type="text" 
                                    value={editingMember.code || ''}
                                    onChange={(e) => setEditingMember({ ...editingMember, code: e.target.value })}
                                    className="flex-1 bg-black border border-white/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-white/30"
                                  />
                                  <button 
                                    onClick={() => {
                                      const word = THEME_WORDS[Math.floor(Math.random() * THEME_WORDS.length)];
                                      const num = Math.floor(Math.random() * 900) + 100;
                                      setEditingMember({ ...editingMember, code: `FDS-${word}-${num}` });
                                    }}
                                    className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-cream-100/60 hover:bg-white/10 text-sm font-bold transition-all"
                                  >
                                    Neu
                                  </button>
                                </div>
                                {editingMember.code && (
                                  <div className="mt-6 space-y-4">
                                    <div 
                                      ref={qrCardRef}
                                      className="relative w-full aspect-video rounded-2xl overflow-hidden flex bg-forest-950 border border-white/20 shadow-2xl"
                                    >
                                                                            <div className="absolute inset-0">
                                        <img 
                                          src="/forest-stream.jpg" 
                                          alt="Schwarzwald" 
                                          className="w-full h-full object-cover"
                                        />
                                      </div>
                                      
                                      <div className="relative z-10 flex w-full p-6 items-center justify-between">
                                        <div className="flex flex-col justify-between h-full">
                                          <div className="flex items-start gap-2">
                                            <div className="bg-white p-1 rounded-lg shadow-sm">
                                              <img src="/logo.jpg" alt="Logo" className="w-24 h-auto" />
                                            </div>
                                          </div>
                                          <div>
                                            <p className="text-[10px] uppercase tracking-widest text-moss-400 font-black drop-shadow-md">Mitgliedsausweis</p>
                                            <h3 className="text-xl font-black text-white mt-1 leading-tight drop-shadow-lg">{editingMember.memberName || 'Neues Mitglied'}</h3>
                                            <p className="text-sm text-moss-300 font-bold mt-1 drop-shadow-md">Saunameister</p>
                                          </div>
                                          <div>
                                            <p className="text-xs text-white/90 font-medium drop-shadow-md">Saunafreunde Schwarzwald</p>
                                            <p className="text-sm font-mono text-moss-300 mt-1 drop-shadow-md">{editingMember.code}</p>
                                          </div>
                                        </div>
                                        <div className="bg-white p-2.5 rounded-xl shrink-0 shadow-2xl">
                                          <QRCodeSVG value={editingMember.code} size={90} />
                                        </div>
                                      </div>
                                    </div>
                                    
                                    <button
                                      onClick={async () => {
                                        if (!qrCardRef.current) return;
                                        try {
                                          const dataUrl = await toJpeg(qrCardRef.current, { 
                                            quality: 0.95, 
                                            pixelRatio: 2,
                                            useCORS: true,
                                            cacheBust: true,
                                          });
                                          const link = document.createElement('a');
                                          link.download = `Saunafreunde-Ausweis-${(editingMember.memberName || 'Mitglied').replace(/\s+/g, '-')}.jpg`;
                                          link.href = dataUrl;
                                          link.click();
                                        } catch (err) {
                                          console.error('Failed to generate image', err);
                                          alert('Fehler beim Speichern des Bildes. Bitte versuche es erneut.');
                                        }
                                      }}
                                      className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-white/10 text-white font-bold text-sm hover:bg-white/20 transition-all"
                                    >
                                      <Download className="w-4 h-4" />
                                      Als JPG herunterladen
                                    </button>
                                    
                                    {!editingMember.isNew && (
                                      <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/10">
                                        <div className="flex flex-col gap-2">
                                          <label className="text-[10px] font-bold text-cream-100/40 uppercase tracking-widest">Gültig von (Optional)</label>
                                          <input 
                                            type="datetime-local" 
                                            value={memberCodeValidFrom}
                                            onChange={(e) => setMemberCodeValidFrom(e.target.value)}
                                            className="bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-cream-100"
                                          />
                                        </div>
                                        <div className="flex flex-col gap-2">
                                          <label className="text-[10px] font-bold text-cream-100/40 uppercase tracking-widest">Gültig bis (Optional)</label>
                                          <input 
                                            type="datetime-local" 
                                            value={memberCodeValidUntil}
                                            onChange={(e) => setMemberCodeValidUntil(e.target.value)}
                                            className="bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-cream-100"
                                          />
                                        </div>
                                        <button
                                          onClick={() => generateDailyCode('member', editingMember.code, memberCodeValidFrom, memberCodeValidUntil)}
                                          disabled={isGeneratingCode}
                                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-moss-500/20 text-moss-500 font-bold text-sm hover:bg-moss-500/30 transition-all disabled:opacity-50 mt-2"
                                        >
                                          Tagescode generieren
                                        </button>
                                        
                                        {generatedMemberCode && (
                                          <div className="mt-4 p-4 bg-moss-500/10 border border-moss-500/20 rounded-xl text-center">
                                            <p className="text-[10px] uppercase tracking-widest text-moss-400 font-bold mb-1">Generierter Tagescode</p>
                                            <p className="text-3xl font-mono font-black text-moss-400 tracking-widest">{generatedMemberCode}</p>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                              
                              <div className="space-y-2">
                                <label className="text-[10px] font-bold text-cream-100/40 ml-1">Qualifikationen</label>
                                <div className="grid grid-cols-2 gap-2">
                                  {(Object.keys(QUALIFICATION_ICONS) as Qualification[]).map(q => (
                                    <button
                                      key={q}
                                      onClick={() => toggleQualification(q)}
                                      className={cn(
                                        "flex items-center gap-2 p-2 rounded-xl border text-[10px] font-bold transition-all",
                                        editingMember.qualifications.includes(q) 
                                          ? "bg-moss-500/20 border-moss-500/50 text-moss-500" 
                                          : "bg-white/5 border-white/10 text-cream-100/30"
                                      )}
                                    >
                                      <span>{QUALIFICATION_ICONS[q].icon}</span>
                                      <span className="truncate">{QUALIFICATION_ICONS[q].label}</span>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              <div className="pt-4 border-t border-white/5 space-y-3">
                                <button
                                  onClick={() => setEditingMember({ ...editingMember, isAdmin: !editingMember.isAdmin })}
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                    editingMember.isAdmin ? "bg-amber-500/10 border-amber-500/30 text-amber-500" : "bg-white/5 border-white/10 text-cream-100/30"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <ShieldCheck className="w-5 h-5" />
                                    <div className="text-left">
                                      <p className="text-sm font-bold">Admin-Rechte</p>
                                      <p className="text-[10px] opacity-60">Darf System-Einstellungen ändern</p>
                                    </div>
                                  </div>
                                  <div className={cn("w-10 h-6 rounded-full transition-colors relative", editingMember.isAdmin ? "bg-amber-500" : "bg-white/10")}>
                                    <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", editingMember.isAdmin ? "right-1" : "left-1")} />
                                  </div>
                                </button>

                                <button
                                  onClick={() => setEditingMember({ ...editingMember, isFamily: !editingMember.isFamily })}
                                  className={cn(
                                    "w-full flex items-center justify-between p-4 rounded-2xl border transition-all",
                                    editingMember.isFamily ? "bg-moss-500/10 border-moss-500/30 text-moss-500" : "bg-white/5 border-white/10 text-cream-100/30"
                                  )}
                                >
                                  <div className="flex items-center gap-3">
                                    <Users className="w-5 h-5" />
                                    <div className="text-left">
                                      <p className="text-sm font-bold">Familienmitgliedschaft</p>
                                      <p className="text-[10px] opacity-60">Fragt beim Check-in nach der Anzahl der Personen</p>
                                    </div>
                                  </div>
                                  <div className={cn("w-10 h-6 rounded-full transition-colors relative", editingMember.isFamily ? "bg-moss-500" : "bg-white/10")}>
                                    <div className={cn("absolute top-1 w-4 h-4 rounded-full bg-white transition-all", editingMember.isFamily ? "right-1" : "left-1")} />
                                  </div>
                                </button>
                              </div>
                            </div>

                            <button
                              onClick={updateMemberOnServer}
                              disabled={isUpdating}
                              className="w-full py-3 rounded-2xl bg-moss-500 text-white font-black text-sm shadow-lg shadow-moss-500/20 hover:brightness-110 disabled:opacity-50"
                            >
                              {isUpdating ? 'Speichert...' : 'Änderungen übernehmen'}
                            </button>
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center opacity-20 py-12">
                            <UserCheck className="w-12 h-12 mb-4" />
                            <p className="font-bold">Mitglied auswählen zum Bearbeiten</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-sm font-black uppercase tracking-widest text-cream-100/30">Letzte Aktivitäten</h3>
                    <div className="max-h-60 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                      {logs.map(log => (
                        <div key={log.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 text-xs">
                          <span className="font-mono text-cream-100/30">{log.code}</span>
                          <span className="font-bold text-cream-100/70">{log.message}</span>
                          <span className="text-cream-100/20">{log.time}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Guest Code Section */}
                  <div className="space-y-6 pt-6 border-t border-white/5">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-black uppercase tracking-widest text-cream-100/30">Tagesgäste</h3>
                    </div>
                    <div className="glass p-6 rounded-3xl border-white/5 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-sm font-bold text-cream-100">Einmaligen Tagescode erstellen</p>
                          <p className="text-xs text-cream-100/40">Gültig für 24 Stunden (oder nach Auswahl)</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-cream-100/40 uppercase tracking-widest">Gültig von (Optional)</label>
                          <input 
                            type="datetime-local" 
                            value={guestCodeValidFrom}
                            onChange={(e) => setGuestCodeValidFrom(e.target.value)}
                            className="bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-cream-100"
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-cream-100/40 uppercase tracking-widest">Gültig bis (Optional)</label>
                          <input 
                            type="datetime-local" 
                            value={guestCodeValidUntil}
                            onChange={(e) => setGuestCodeValidUntil(e.target.value)}
                            className="bg-forest-950 border border-white/10 rounded-lg px-3 py-2 text-xs text-cream-100"
                          />
                        </div>
                      </div>
                      
                      <button
                        onClick={() => generateDailyCode('guest', `Gast-${Date.now().toString().slice(-4)}`, guestCodeValidFrom, guestCodeValidUntil)}
                        disabled={isGeneratingCode}
                        className="w-full py-3 rounded-xl bg-moss-500 text-white font-bold text-sm hover:brightness-110 transition-all disabled:opacity-50"
                      >
                        Code generieren
                      </button>

                      {generatedGuestCode && (
                        <div className="mt-4 p-4 bg-white/5 border border-white/10 rounded-xl text-center">
                          <p className="text-[10px] uppercase tracking-widest text-cream-100/40 font-bold mb-1">Neuer Tagescode</p>
                          <p className="text-3xl font-mono font-black text-moss-400 tracking-widest">{generatedGuestCode}</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={resetToScanner}
                    className="w-full py-5 rounded-3xl bg-wood-500 text-white font-black text-lg shadow-xl shadow-wood-500/20 hover:brightness-110 active:scale-[0.98] transition-all"
                  >
                    Einstellungen Speichern & Beenden
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <footer className="mt-12 text-center opacity-20">
        <p className="text-[10px] font-black uppercase tracking-[0.4em]">Saunafreunde Schwarzwald e.V.</p>
      </footer>
    </div>
  );
}
