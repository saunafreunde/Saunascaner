import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;
  const DATA_FILE = path.join(process.cwd(), "members.json");
  const CONFIG_FILE = path.join(process.cwd(), "config.json");

  app.use(express.json());

  // Load or initialize config
  let scannerConfig: Record<string, any> = {
    apiUrl: '',
    deviceName: 'Scanner 1',
    soundEnabled: true,
    feedbackQuestions: [
      { id: 'q1', text: 'Neues Wedeltuch (15€) – möchtest du eins?', type: 'yes_no' },
      { id: 'q2', text: 'Sauna-Fest 2026', type: 'event' }
    ]
  };

  const saveConfig = () => {
    try {
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(scannerConfig, null, 2));
    } catch (err) {
      console.error("Failed to save config", err);
    }
  };

  if (fs.existsSync(CONFIG_FILE)) {
    try {
      scannerConfig = JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8"));
    } catch (err) {
      console.error("Failed to load config", err);
    }
  }

  // Daily Codes
  let dailyCodes: Record<string, any> = {};
  const DAILY_CODES_FILE = path.join(process.cwd(), "daily_codes.json");

  const saveDailyCodes = () => {
    try {
      fs.writeFileSync(DAILY_CODES_FILE, JSON.stringify(dailyCodes, null, 2));
    } catch (err) {}
  };

  if (fs.existsSync(DAILY_CODES_FILE)) {
    try {
      dailyCodes = JSON.parse(fs.readFileSync(DAILY_CODES_FILE, "utf-8"));
    } catch (err) {}
  }

  const cleanupCodes = () => {
    const now = Date.now();
    let changed = false;
    for (const [code, data] of Object.entries(dailyCodes)) {
      if (data.expiresAt < now) {
        delete dailyCodes[code];
        changed = true;
      }
    }
    if (changed) saveDailyCodes();
  };
  setInterval(cleanupCodes, 60 * 60 * 1000);

  // Load or initialize members
  let members: Record<string, any> = {};
  
  const saveMembers = () => {
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(members, null, 2));
    } catch (err) {
      console.error("Failed to save members", err);
    }
  };

  if (fs.existsSync(DATA_FILE)) {
    try {
      members = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
    } catch (err) {
      console.error("Failed to load members, initializing defaults", err);
    }
  }

  if (Object.keys(members).length === 0) {
    // Ensure the specific admin code works as a member too
    members['001-FDS'] = {
      code: '001-FDS',
      member_number: 'ADMIN-001',
      name: 'System Admin',
      status: 'aktiv',
      present: false,
      visits_30_days: 99,
      visits_365_days: 999,
      visits_total: 9999,
      warning: 'Administrator Account',
      is_admin: true,
      qualifications: ['saunameister', 'vertiefung', 'grundkurs'],
      feedback_questions: []
    };

    saveMembers();
  }

  // API routes
  app.get("/api/config", (req, res) => {
    res.json(scannerConfig);
  });

  app.post("/api/config", (req, res) => {
    scannerConfig = { ...scannerConfig, ...req.body };
    saveConfig();
    res.json({ ok: true });
  });

  app.get("/api/members", (req, res) => {
    res.json(Object.values(members));
  });

  app.post("/api/members/create", (req, res) => {
    const { code: providedCode, name, qualifications, is_admin, is_family } = req.body;
    
    let code = providedCode;
    if (!code || members[code]) {
      // Generate a new code, e.g., FDS-XXX
      const currentIds = Object.keys(members)
        .filter(k => k.startsWith('FDS-'))
        .map(k => parseInt(k.split('-')[1]))
        .filter(n => !isNaN(n));
      
      const nextId = currentIds.length > 0 ? Math.max(...currentIds) + 1 : 2;
      const idStr = nextId.toString().padStart(3, '0');
      code = `FDS-${idStr}`;
    }

    members[code] = {
      code: code,
      member_number: code,
      name: name || `Neues Mitglied`,
      status: "aktiv",
      present: false,
      visits_30_days: 0,
      visits_365_days: 0,
      visits_total: 0,
      warning: "",
      auto_checkout_info: false,
      is_admin: is_admin || false,
      is_family: is_family || false,
      qualifications: qualifications || [],
      feedback_questions: []
    };
    saveMembers();
    res.json({ ok: true, member: members[code] });
  });

  app.post("/api/members/update", (req, res) => {
    const { code, name, qualifications, is_admin, is_family } = req.body;
    if (members[code]) {
      members[code].name = name;
      members[code].qualifications = qualifications;
      if (typeof is_admin === 'boolean') {
        members[code].is_admin = is_admin;
      }
      if (typeof is_family === 'boolean') {
        members[code].is_family = is_family;
      }
      saveMembers();
      return res.json({ ok: true, member: members[code] });
    }
    res.status(404).json({ error: "Mitglied nicht gefunden" });
  });

  app.post("/api/members/feedback", (req, res) => {
    const { code, answers } = req.body;
    if (members[code]) {
      members[code].feedback_answers = { ...(members[code].feedback_answers || {}), ...answers };
      saveMembers();
      return res.json({ ok: true });
    }
    res.status(404).json({ error: "Mitglied nicht gefunden" });
  });

  app.get("/api/daily-codes", (req, res) => {
    cleanupCodes();
    res.json(dailyCodes);
  });

  app.post("/api/daily-codes/generate", (req, res) => {
    const { type, ref, validFrom, validUntil } = req.body;
    cleanupCodes();

    // Check if one already exists for this ref and is currently valid
    // If we are passing custom dates, we might want to generate a new one anyway,
    // but let's just generate a new one if validFrom/validUntil are provided,
    // or if one doesn't exist.
    if (!validFrom && !validUntil) {
      for (const [code, data] of Object.entries(dailyCodes)) {
        if (data.type === type && data.ref === ref) {
          return res.json({ code, ...data });
        }
      }
    }

    let newCode;
    do {
      newCode = Math.floor(100000 + Math.random() * 900000).toString();
    } while (dailyCodes[newCode]);

    const start = validFrom ? new Date(validFrom).getTime() : Date.now();
    const end = validUntil ? new Date(validUntil).getTime() : start + 24 * 60 * 60 * 1000;

    dailyCodes[newCode] = { type, ref, validFrom: start, expiresAt: end };
    saveDailyCodes();
    
    res.json({ code: newCode, type, ref, validFrom: start, expiresAt: end });
  });

  app.post("/api/scan", (req, res) => {
    const { ausweis_nr, family_count } = req.body;
    const code = ausweis_nr.toUpperCase();
    
    cleanupCodes();

    let member = null;

    if (dailyCodes[code]) {
      const data = dailyCodes[code];
      const now = Date.now();
      
      if (data.validFrom && now < data.validFrom) {
        return res.status(400).json({ error: "Dieser Code ist noch nicht gültig." });
      }

      if (data.type === 'member' && members[data.ref]) {
        member = members[data.ref];
      } else if (data.type === 'guest') {
        // Guest check-in logic
        return res.json({
          ok: true,
          name: `Gast: ${data.ref}`,
          member_number: `GUEST-${code}`,
          status: "aktiv",
          present: false,
          visits_30_days: 0,
          visits_365_days: 0,
          visits_total: 0,
          warning: "Tagesgast",
          is_admin: false,
          qualifications: [],
          feedback_questions: scannerConfig.feedbackQuestions || []
        });
      }
    } else if (members[code]) {
      member = members[code];
    }

    if (member) {
      if (member.present) {
        // Check-out
        member.present = false;
        const durationMs = Date.now() - (member.last_checkin || Date.now());
        const durationHours = Math.round(durationMs / (1000 * 60 * 60) * 10) / 10;
        member.last_checkin = null;
        saveMembers();
        return res.json({ 
          ok: true, 
          ...member,
          checkout_message: `Gute Heimfahrt! Heute warst du ${durationHours}h da, bis bald.`,
          feedback_questions: scannerConfig.feedbackQuestions || []
        });
      } else {
        // Check-in
        if (member.is_family && family_count === undefined) {
          return res.json({
            ok: true,
            needs_family_count: true,
            ...member
          });
        }
        
        member.present = true;
        member.last_checkin = Date.now();
        member.visits_total = (member.visits_total || 0) + 1;
        member.visits_30_days = (member.visits_30_days || 0) + 1;
        member.visits_365_days = (member.visits_365_days || 0) + 1;
        if (family_count !== undefined) {
          member.last_family_count = family_count;
        }
        saveMembers();
        return res.json({ 
          ok: true, 
          ...member,
          feedback_questions: scannerConfig.feedbackQuestions || []
        });
      }
    }

    // Fallback for codes not in the list
    res.json({
      ok: true,
      name: "Gast / Unbekannt",
      member_number: code,
      status: "aktiv",
      present: false,
      visits_30_days: 0,
      visits_365_days: 0,
      visits_total: 0,
      warning: "Mitglied nicht in der Testliste.",
      is_admin: code === '001-FDS',
      qualifications: [],
      feedback_questions: scannerConfig.feedbackQuestions || []
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
