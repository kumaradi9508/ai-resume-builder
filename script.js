// =============================================
//   AI RESUME BUILDER - script.js
//   Features: Chat, AI, Templates, PDF, ATS
// =============================================

// ===== STATE =====
let resumeData = {
  name: '', title: '', email: '', phone: '', location: '', linkedin: '', github: '', website: '',
  summary: '',
  experience: [],   // [{company, role, dates, bullets:[]}]
  education: [],    // [{school, degree, field, dates, gpa}]
  skills: [],       // ['skill1','skill2',...]
  projects: [],     // [{name, desc, tech:[]}]
  certifications: []// [{name, org, date}]
};

let hiddenSections = new Set();
let currentTemplate = 'modern';
let zoomLevel = 0.75;
let chatStep = 'welcome';
let isTyping = false;

let conversationHistory = [];
let currentField = null;

// ===== INIT =====
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splash').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash').style.display = 'none';
      document.getElementById('app').style.display = 'block';
    }, 500);
    init();
  }, 1800);
});

function init() {
  loadSaved();
  setupEventListeners();
  applyZoom();
  renderResume();
  startConversation();

  updateAtsScore();
}

// ===== EVENT LISTENERS =====
function setupEventListeners() {
  // Send button
  document.getElementById('sendBtn').addEventListener('click', handleSend);
  // Enter key
  document.getElementById('userInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    autoResize(e.target);
  });
  document.getElementById('userInput').addEventListener('input', (e) => autoResize(e.target));

  // Theme toggle
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    const icon = document.getElementById('themeToggle').querySelector('i');
    icon.className = document.body.classList.contains('light-mode') ? 'fas fa-sun' : 'fas fa-moon';
  });

  // Save / Download
  document.getElementById('saveBtn').addEventListener('click', saveProgress);
  document.getElementById('downloadBtn').addEventListener('click', downloadPDF);
  document.getElementById('printBtn').addEventListener('click', () => window.print());

  // Template select
  document.getElementById('templateSelect').addEventListener('change', (e) => {
    currentTemplate = e.target.value; renderResume();
  });

  // Zoom
  document.getElementById('zoomIn').addEventListener('click', () => { zoomLevel = Math.min(1.2, zoomLevel + 0.1); applyZoom(); });
  document.getElementById('zoomOut').addEventListener('click', () => { zoomLevel = Math.max(0.4, zoomLevel - 0.1); applyZoom(); });

  // Clear chat
  document.getElementById('clearChat').addEventListener('click', () => {
    document.getElementById('chatMessages').innerHTML = '';
    conversationHistory = [];
    chatStep = 'welcome';
    startConversation();
  });

  // Expand chat
  document.getElementById('expandChat').addEventListener('click', () => {
    const panel = document.getElementById('chatPanel');
    panel.style.width = panel.style.width === '700px' ? '' : '700px';
  });

  // Attach (JD modal)
  document.getElementById('attachBtn').addEventListener('click', () => {
    document.getElementById('jdModal').style.display = 'flex';
  });
  document.getElementById('closeJdModal').addEventListener('click', () => { document.getElementById('jdModal').style.display = 'none'; });
  document.getElementById('closeJdModal2').addEventListener('click', () => { document.getElementById('jdModal').style.display = 'none'; });
  document.getElementById('analyzeJdModal').addEventListener('click', () => {
    const jd = document.getElementById('jdModalText').value.trim();
    if (jd) { analyzeJobDescription(jd); document.getElementById('jdModal').style.display = 'none'; }
  });
  document.getElementById('analyzeJD').addEventListener('click', () => {
    const jd = document.getElementById('jobDesc').value.trim();
    if (jd) analyzeJobDescription(jd);
    else showToast('Please paste a job description first', 'error');
  });



  // Section manager
  document.querySelectorAll('.section-item').forEach(item => {
    item.addEventListener('click', () => {
      const sec = item.dataset.section;
      if (hiddenSections.has(sec)) { hiddenSections.delete(sec); item.classList.add('active'); }
      else { hiddenSections.add(sec); item.classList.remove('active'); }
      renderResume();
    });
  });

  // Step indicators click
  document.querySelectorAll('.step').forEach(s => {
    s.addEventListener('click', () => {
      const step = parseInt(s.dataset.step);
      jumpToStep(step);
    });
  });
}

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

function applyZoom() {
  document.getElementById('resumePaper').style.transform = `scale(${zoomLevel})`;
  document.getElementById('previewWrapper').style.paddingTop = zoomLevel < 0.7 ? '10px' : '20px';
}

// ===== CONVERSATION FLOW =====
const CONVERSATION_FLOW = [
  { step: 'welcome', field: null },
  { step: 'name', field: 'name', q: "Great! Let's start. What's your **full name**?" },
  { step: 'title', field: 'title', q: "What's your **job title or target role**? (e.g., *Software Engineer*, *Data Analyst*)" },
  { step: 'contact', field: 'email', q: "Now your **contact info**. Please provide your **email address**:" },
  { step: 'phone', field: 'phone', q: "Your **phone number**:" },
  { step: 'location', field: 'location', q: "Your **location** (City, Country):" },
  { step: 'linkedin', field: 'linkedin', q: "Your **LinkedIn URL** (or type *skip* to skip):" },
  { step: 'summary', field: 'summary', q: "Let me write an **AI-generated professional summary** for you! Just describe yourself in a few words, or tell me your years of experience and I'll craft it:" },
  { step: 'exp_start', field: null, q: "Now let's add your **work experience**. How many jobs would you like to add? (1-5)" },
  { step: 'edu_start', field: null, q: "Let's add your **education**. What's your highest degree?" },
  { step: 'skills', field: 'skills', q: "List your **key skills** (comma-separated), e.g., *Python, React, SQL, Machine Learning*:" },
  { step: 'projects', field: null, q: "Would you like to add **projects**? Type *yes* to add or *skip* to continue:" },
  { step: 'certifications', field: null, q: "Do you have any **certifications**? (e.g., AWS, Google, Coursera) Type them or *skip*:" },
  { step: 'done', field: null }
];

let flowIndex = 0;
let expCount = 0; let expCurrent = 0; let expStage = 0;
let eduCount = 0; let eduCurrent = 0; let projCount = 0; let certCount = 0;

function startConversation() {
  flowIndex = 0; expCount = 0; expCurrent = 0; expStage = 0;
  setTimeout(() => {
    addBotMessage(`👋 **Welcome to ResumeAI!** I'm your personal AI resume assistant powered by Gemini.

I'll help you create a **professional, ATS-optimized resume** tailored to your job description. Let's build it step by step!

Ready to start? Click **"Let's Go!"** or type anything!`, [
      { label: "🚀 Let's Go!", action: () => nextStep() },
      { label: '📋 Load Sample', action: () => loadSample() }
    ]);
  }, 300);
}

function nextStep() {
  flowIndex++;
  if (flowIndex >= CONVERSATION_FLOW.length) { flowIndex = CONVERSATION_FLOW.length - 1; return; }
  const step = CONVERSATION_FLOW[flowIndex];
  chatStep = step.step;

  if (step.step === 'done') {
    addBotMessage(`🎉 **Your resume is complete!** Here's what you can do:

✅ **Preview** your resume on the right panel
📥 **Download PDF** using the button above
🔧 **Customize** using the tools panel
💬 Ask me to: *improve my summary*, *add more experience*, *make it ATS-friendly*, etc.

Your resume looks amazing! Good luck! 🚀`);
    updateStep(4);
    return;
  }

  if (step.step === 'exp_start') {
    addBotMessage(`Now let's add your **work experience**. How many positions would you like to add? (Enter a number 1–5):`, []);
    return;
  }
  if (step.step === 'edu_start') {
    addBotMessage(`Let's add your **education**. What's your highest degree? *(e.g., B.Tech in Computer Science from XYZ University, 2020-2024)*`, []);
    chatStep = 'edu_entry';
    return;
  }
  if (step.step === 'projects') {
    addBotMessage(`Would you like to add **personal/academic projects**?`, [
      { label: "✅ Yes, add projects", action: () => { chatStep = 'proj_name'; addBotMessage("What's the **project name**?"); } },
      { label: "⏭️ Skip", action: () => { nextStep(); } }
    ]);
    return;
  }
  if (step.step === 'certifications') {
    addBotMessage(`Do you have any **certifications**? *(e.g., "AWS Cloud Practitioner - Amazon, 2024")*`, [
      { label: "✅ Add Certifications", action: () => { chatStep = 'cert_entry'; addBotMessage("Enter your certification: *(Name - Organization, Year)*"); } },
      { label: "⏭️ Skip", action: () => nextStep() }
    ]);
    return;
  }

  if (step.q) addBotMessage(step.q);
  currentField = step.field;
}

async function handleSend() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text || isTyping) return;

  input.value = ''; input.style.height = 'auto';
  addUserMessage(text);
  await processInput(text);
}

async function processInput(text) {
  const lower = text.toLowerCase().trim();

  // Special commands at any step
  if (lower === 'help') { addBotMessage(`I can help you with:\n\n• **Build resume** step by step\n• **Improve** any section\n• **Add** experience, skills, projects\n• **ATS optimize** your resume\n• **Tailor** for a specific job\n\nJust ask naturally!`); return; }

  switch (chatStep) {
    case 'welcome':
      nextStep(); break;

    case 'name':
      resumeData.name = text;
      renderResume(); showToast('Name saved ✓', 'success');
      nextStep(); break;

    case 'title':
      resumeData.title = text;
      renderResume(); nextStep(); break;

    case 'contact':
      resumeData.email = text;
      renderResume(); nextStep(); break;

    case 'phone':
      resumeData.phone = text;
      renderResume(); nextStep(); break;

    case 'location':
      resumeData.location = text;
      renderResume(); nextStep(); break;

    case 'linkedin':
      if (lower !== 'skip') resumeData.linkedin = text;
      renderResume(); nextStep(); break;

    case 'summary':
      showTyping();
      const summary = await generateSummary(text);
      hideTyping();
      resumeData.summary = summary;
      renderResume(); updateAtsScore();
      addBotMessage(`✅ **Summary generated!**\n\n*"${summary}"*\n\nWant me to **revise** it or shall we continue?`, [
        { label: "✅ Looks good!", action: () => nextStep() },
        { label: "🔄 Regenerate", action: () => { chatStep = 'summary'; addBotMessage("Tell me more about yourself and I'll try again:"); } }
      ]);
      chatStep = 'summary_confirm'; break;

    case 'summary_confirm':
      if (lower.includes('good') || lower.includes('ok') || lower.includes('continue') || lower.includes('next') || lower.includes('yes')) {
        nextStep();
      } else {
        showTyping();
        const newSum = await generateSummary(text);
        hideTyping();
        resumeData.summary = newSum; renderResume();
        addBotMessage(`✅ Updated!\n\n*"${newSum}"*`, [
          { label: "✅ Perfect!", action: () => nextStep() },
          { label: "🔄 Try Again", action: () => addBotMessage("Describe yourself differently:") }
        ]);
      }
      break;

    case 'exp_start': {
      const n = parseInt(text);
      if (!isNaN(n) && n > 0 && n <= 10) {
        expCount = n; expCurrent = 0; expStage = 0;
        resumeData.experience = [];
        chatStep = 'exp_company';
        addBotMessage(`**Experience ${expCurrent + 1}/${expCount}:** What's the **company name**?`);
        updateStep(2);
      } else addBotMessage("Please enter a valid number (1-5):");
      break;
    }

    case 'exp_company': {
      if (!resumeData.experience[expCurrent]) resumeData.experience[expCurrent] = { company: '', role: '', dates: '', bullets: [] };
      resumeData.experience[expCurrent].company = text;
      chatStep = 'exp_role';
      addBotMessage(`Your **job title/role** at ${text}?`);
      break;
    }

    case 'exp_role': {
      resumeData.experience[expCurrent].role = text;
      chatStep = 'exp_dates';
      addBotMessage(`**Duration** (e.g., *Jan 2022 – Dec 2023* or *2022 – Present*):`);
      break;
    }

    case 'exp_dates': {
      resumeData.experience[expCurrent].dates = text;
      chatStep = 'exp_bullets';
      addBotMessage(`Briefly describe your **responsibilities/achievements** at this role (I'll convert them into professional bullet points!):`);
      break;
    }

    case 'exp_bullets': {
      showTyping();
      const bullets = await generateBullets(resumeData.experience[expCurrent].role, resumeData.experience[expCurrent].company, text);
      hideTyping();
      resumeData.experience[expCurrent].bullets = bullets;
      renderResume(); updateAtsScore();
      expCurrent++;
      if (expCurrent < expCount) {
        chatStep = 'exp_company';
        addBotMessage(`✅ **Experience added!**\n\n**Experience ${expCurrent + 1}/${expCount}:** Company name?`);
      } else {
        addBotMessage(`✅ **All ${expCount} experience(s) added!**`, [{ label: "Continue →", action: () => nextStep() }]);
        chatStep = 'exp_done';
      }
      break;
    }

    case 'exp_done':
      nextStep(); break;

    case 'edu_entry': {
      // Parse education entry
      const edu = parseEducation(text);
      resumeData.education.push(edu);
      renderResume(); updateAtsScore();
      addBotMessage(`✅ Education added!\n\nAdd **another degree** or click Continue:`, [
        { label: "➕ Add Another", action: () => addBotMessage("Enter next education entry:") },
        { label: "Continue →", action: () => { chatStep = 'edu_done'; nextStep(); } }
      ]);
      chatStep = 'edu_more';
      break;
    }

    case 'edu_more': {
      const edu2 = parseEducation(text);
      resumeData.education.push(edu2);
      renderResume();
      addBotMessage(`✅ Added! Another or continue?`, [
        { label: "➕ More", action: () => addBotMessage("Enter next:") },
        { label: "Continue →", action: () => { chatStep = 'edu_done'; nextStep(); } }
      ]);
      break;
    }

    case 'skills': {
      const skills = text.split(/,|;|\n/).map(s => s.trim()).filter(s => s.length > 0);
      resumeData.skills = [...new Set([...resumeData.skills, ...skills])];
      renderResume(); updateAtsScore();
      updateStep(3);
      showTyping();
      const suggested = await suggestSkills(resumeData.title, resumeData.skills);
      hideTyping();
      if (suggested.length > 0) {
        addBotMessage(`✅ **Skills added!** Here are some **AI-suggested skills** for a ${resumeData.title}:\n\n${suggested.join(', ')}\n\nWant to add any?`, [
          { label: "✅ Add All", action: () => { resumeData.skills = [...new Set([...resumeData.skills, ...suggested])]; renderResume(); updateAtsScore(); nextStep(); } },
          { label: "✅ Continue", action: () => nextStep() }
        ]);
      } else nextStep();
      chatStep = 'skills_confirm';
      break;
    }

    case 'skills_confirm':
      nextStep(); break;

    case 'proj_name': {
      const p = { name: text, desc: '', tech: [] };
      resumeData.projects.push(p);
      chatStep = 'proj_desc';
      addBotMessage(`**Describe** this project (what it does, your role, impact):`);
      break;
    }

    case 'proj_desc': {
      const pi = resumeData.projects[resumeData.projects.length - 1];
      pi.desc = text;
      chatStep = 'proj_tech';
      addBotMessage(`**Technologies used** (comma-separated, e.g., *Python, Flask, React*):`);
      break;
    }

    case 'proj_tech': {
      const pi2 = resumeData.projects[resumeData.projects.length - 1];
      pi2.tech = text.split(/,|;/).map(t => t.trim()).filter(t => t);
      renderResume(); updateAtsScore();
      addBotMessage(`✅ **Project added!**`, [
        { label: "➕ Add Another", action: () => { chatStep = 'proj_name'; addBotMessage("Project name?"); } },
        { label: "Continue →", action: () => { chatStep = 'proj_done'; nextStep(); } }
      ]);
      chatStep = 'proj_more';
      break;
    }

    case 'proj_more':
      if (lower === 'yes' || lower.includes('add')) {
        chatStep = 'proj_name'; addBotMessage("Project name?");
      } else nextStep();
      break;

    case 'proj_done':
      nextStep(); break;

    case 'cert_entry': {
      const parts = text.split(/[-–,]/);
      const cert = {
        name: parts[0]?.trim() || text,
        org: parts[1]?.trim() || '',
        date: parts[2]?.trim() || ''
      };
      resumeData.certifications.push(cert);
      renderResume(); updateAtsScore();
      addBotMessage(`✅ Certification added!`, [
        { label: "➕ Add Another", action: () => addBotMessage("Enter another certification:") },
        { label: "Continue →", action: () => { chatStep = 'cert_done'; nextStep(); } }
      ]);
      chatStep = 'cert_more';
      break;
    }

    case 'cert_more':
      if (lower === 'yes' || lower.includes('add')) { chatStep = 'cert_entry'; addBotMessage("Enter certification:"); }
      else nextStep();
      break;

    case 'cert_done':
      nextStep(); break;

    default:
      // Free-form AI conversation
      await handleFreeForm(text);
      break;
  }
}

// ===== FREE-FORM AI HANDLER =====
async function handleFreeForm(text) {
  const lower = text.toLowerCase();

  // Keyword routing
  if (lower.includes('improve') && lower.includes('summary')) {
    showTyping();
    const imp = await improveSection('summary', resumeData.summary, resumeData.title);
    hideTyping();
    resumeData.summary = imp; renderResume();
    addBotMessage(`✅ **Summary improved!**\n\n*"${imp}"*`);
  } else if (lower.includes('ats') || lower.includes('optimize')) {
    await doAtsOptimize();
  } else if (lower.includes('suggest') && lower.includes('skill')) {
    showTyping();
    const sug = await suggestSkills(resumeData.title, resumeData.skills);
    hideTyping();
    addBotMessage(`💡 **Suggested skills for ${resumeData.title}:**\n\n${sug.join(', ')}`, [
      { label: "✅ Add All", action: () => { resumeData.skills = [...new Set([...resumeData.skills, ...sug])]; renderResume(); updateAtsScore(); showToast("Skills added!", "success"); } }
    ]);
  } else if (lower.includes('add') && (lower.includes('experience') || lower.includes('job'))) {
    chatStep = 'exp_company';
    expCurrent = resumeData.experience.length;
    if (!resumeData.experience[expCurrent]) resumeData.experience[expCurrent] = { company: '', role: '', dates: '', bullets: [] };
    addBotMessage("**Company name** for the new experience?");
  } else if (lower.includes('add') && lower.includes('project')) {
    chatStep = 'proj_name';
    addBotMessage("What's the **project name**?");
  } else if (lower.includes('add') && lower.includes('skill')) {
    const skills = text.replace(/add|skill|skills/gi, '').split(/,|;/).map(s => s.trim()).filter(s => s);
    if (skills.length > 0) { resumeData.skills = [...new Set([...resumeData.skills, ...skills])]; renderResume(); updateAtsScore(); addBotMessage(`✅ Added: **${skills.join(', ')}**`); }
    else addBotMessage("What skills would you like to add? (comma-separated)");
  } else if (lower.includes('tailor') || lower.includes('job description') || lower.includes('paste job')) {
    addBotMessage("Please paste the **job description** below and I'll tailor your resume:", [], true);
    chatStep = 'jd_tailor';
  } else if (chatStep === 'jd_tailor') {
    analyzeJobDescription(text);
    chatStep = 'done';
  } else {
    // Generic AI response
    showTyping();
    const resp = await callGeminiAI(`You are ResumeAI, a helpful AI resume building assistant. The user is building their resume. Current resume data: ${JSON.stringify(resumeData)}. User says: "${text}". Provide helpful, concise advice. If they want to modify their resume, guide them step by step. Keep response under 120 words.`);
    hideTyping();
    addBotMessage(resp || "I can help you improve your resume! Try asking me to:\n• *Improve my summary*\n• *Suggest skills for my role*\n• *Add a project*\n• *Make it ATS friendly*");
  }
}

// ===== AI API CALLS (proxied through Flask backend) =====
async function callGeminiAI(prompt) {
  try {
    const res = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt })
    });
    if (res.status === 429) {
      return `⚠️ **API quota exceeded.** The server's daily limit has been reached. Please try again later.`;
    }
    if (res.status === 503) {
      return `⚠️ **AI unavailable.** The server has no API key configured. Contact the administrator.`;
    }
    const data = await res.json();
    if (data.error) {
      const msg = data.error || 'Unknown error';
      if (msg.toLowerCase().includes('quota')) {
        return `⚠️ **Quota exceeded.** Server API limit reached. Please try again later.`;
      }
      return `⚠️ Server error: ${msg}`;
    }
    return data.text || null;
  } catch (e) {
    return `⚠️ Connection error. Make sure the Flask server is running (python app.py).`;
  }
}

async function generateSummary(userInput) {
  const prompt = `Write a professional resume summary (3 sentences, 60-80 words) for: Name: ${resumeData.name || 'candidate'}, Title: ${resumeData.title || 'professional'}. User description: "${userInput}". Make it ATS-friendly, achievement-focused, and compelling. Return ONLY the summary text, no quotes or extra text.`;
  const result = await callGeminiAI(prompt);
  if (!result || result.includes('⚠️')) {
    return `Results-driven ${resumeData.title || 'professional'} with expertise in delivering high-quality solutions. Proven track record of collaborating with cross-functional teams to achieve organizational goals. Passionate about leveraging technology to drive innovation and business growth.`;
  }
  return result.trim();
}

async function generateBullets(role, company, desc) {
  const prompt = `Create 3-4 professional resume bullet points for a ${role} at ${company}. User description: "${desc}". Use action verbs, quantify where possible (use realistic numbers), ATS-friendly. Return ONLY bullet points, one per line, starting with •. No extra text.`;
  const result = await callGeminiAI(prompt);
  if (!result || result.includes('⚠️')) {
    return [`Developed and maintained key software components improving system performance by 20%`, `Collaborated with cross-functional teams to deliver projects on time`, `Analyzed requirements and implemented scalable solutions`];
  }
  return result.split('\n').map(b => b.replace(/^[•\-\*]\s*/, '').trim()).filter(b => b.length > 10);
}

async function suggestSkills(role, existing) {
  if (!role) return [];
  const prompt = `Suggest 8 in-demand skills for a ${role}. Existing skills: ${existing.join(', ')}. Return ONLY new skills not in the existing list, comma-separated, no extra text.`;
  const result = await callGeminiAI(prompt);
  if (!result || result.includes('⚠️')) return [];
  return result.split(/,|;|\n/).map(s => s.trim()).filter(s => s.length > 1 && !existing.map(e => e.toLowerCase()).includes(s.toLowerCase())).slice(0, 8);
}

async function improveSection(section, content, title) {
  const prompt = `Improve this resume ${section} for a ${title}: "${content}". Make it more impactful, ATS-friendly, and compelling (under 80 words). Return ONLY improved text.`;
  const result = await callGeminiAI(prompt);
  return (result && !result.includes('⚠️')) ? result.trim() : content;
}

async function doAtsOptimize() {
  const jd = document.getElementById('jobDesc').value.trim();
  showTyping();
  const prompt = `Analyze this resume and provide ATS optimization tips (5 points, concise):
Resume: Name:${resumeData.name}, Title:${resumeData.title}, Skills:${resumeData.skills.join(',')}, Summary:${resumeData.summary}
${jd ? 'Job Description: ' + jd.substring(0, 500) : 'No JD provided.'}
Format: numbered list of actionable tips.`;
  const result = await callGeminiAI(prompt);
  hideTyping();
  addBotMessage(`📊 **ATS Optimization Tips:**\n\n${result || 'Add more keywords, use action verbs, include metrics, match job description language, ensure clean formatting.'}`);
  updateAtsScore();
}

async function analyzeJobDescription(jd) {
  showTyping();
  const prompt = `Extract key skills and keywords from this job description for resume optimization (max 15 items, comma-separated): "${jd.substring(0, 1000)}"`;
  const keywords = await callGeminiAI(prompt);

  // Also improve summary to match JD
  const summaryPrompt = `Rewrite this professional summary to better match this job: Summary:"${resumeData.summary}" JD:"${jd.substring(0, 500)}". Keep under 80 words, ATS-friendly. Return ONLY the summary.`;
  const newSummary = await callGeminiAI(summaryPrompt);
  hideTyping();

  // Guard: only update summary if we got a valid (non-error) response
  if (newSummary && !newSummary.includes('⚠️')) resumeData.summary = newSummary.trim();

  // Guard: if keywords call failed, show error and stop
  if (!keywords || keywords.includes('⚠️')) {
    addBotMessage(`❌ **Could not analyze job description.**\n\n${keywords || 'No response from AI.'}\n\nPlease check your API key in the Tools panel and try again.`);
    return;
  }

  const kwList = keywords.split(/,|;|\n/).map(k => k.trim()).filter(k => k && k.length > 1);
  const newSkills = kwList.filter(k => !resumeData.skills.map(s => s.toLowerCase()).includes(k.toLowerCase()));

  renderResume(); updateAtsScore(85);
  addBotMessage(`🎯 **Resume tailored to job description!**\n\n**Key keywords extracted:**\n${kwList.slice(0, 10).join(', ')}\n\n**New skills identified:** ${newSkills.slice(0, 6).join(', ') || 'None — your resume already covers the key skills!'}\n\nWant me to add these skills to your resume?`, [
    { label: "✅ Add Skills", action: () => { resumeData.skills = [...new Set([...resumeData.skills, ...newSkills.slice(0, 6)])]; renderResume(); updateAtsScore(); showToast("Skills added!", "success"); } },
    { label: "✅ Looks Good", action: () => { } }
  ]);
}

// ===== CHAT UI =====
function addBotMessage(text, choices = [], isInput = false) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg bot';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  let choicesHtml = '';
  if (choices && choices.length > 0) {
    choicesHtml = `<div class="chat-choices">${choices.map((c, i) => `<button class="choice-btn" data-idx="${i}">${c.label}</button>`).join('')}</div>`;
  }

  div.innerHTML = `
    <div class="msg-avatar"><i class="fas fa-robot"></i></div>
    <div>
      <div class="msg-bubble">${markdownToHtml(text)}${choicesHtml}</div>
      <div class="msg-time">${time}</div>
    </div>`;

  msgs.appendChild(div);

  if (choices && choices.length > 0) {
    div.querySelectorAll('.choice-btn').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        choices[i].action();
        div.querySelectorAll('.choice-btn').forEach(b => b.disabled = true);
      });
    });
  }

  msgs.scrollTop = msgs.scrollHeight;
}

function addUserMessage(text) {
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg user';
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  div.innerHTML = `
    <div class="msg-avatar"><i class="fas fa-user"></i></div>
    <div>
      <div class="msg-bubble">${escHtml(text)}</div>
      <div class="msg-time">${time}</div>
    </div>`;
  document.getElementById('chatMessages').appendChild(div);
  document.getElementById('chatMessages').scrollTop = 999999;
}

function showTyping() {
  isTyping = true;
  const msgs = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'msg bot typing-indicator'; div.id = 'typingIndicator';
  div.innerHTML = `<div class="msg-avatar"><i class="fas fa-robot"></i></div><div class="msg-bubble"><div class="typing-dot"></div><div class="typing-dot"></div><div class="typing-dot"></div></div>`;
  msgs.appendChild(div); msgs.scrollTop = 999999;
}

function hideTyping() {
  isTyping = false;
  const t = document.getElementById('typingIndicator');
  if (t) t.remove();
}

function sendQuick(msg) {
  document.getElementById('userInput').value = msg;
  handleSend();
}

// ===== MARKDOWN ===== 
function markdownToHtml(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#6c63ff">$1</a>')
    .replace(/\n/g, '<br>');
}

function escHtml(t) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
}

// ===== RESUME RENDERER =====
function renderResume() {
  const container = document.getElementById('resumeContent');
  const tmpl = currentTemplate;
  container.innerHTML = buildResumeHTML(tmpl);
}

function buildResumeHTML(tmpl) {
  if (!resumeData.name && !resumeData.title) {
    return `<div class="empty-state"><i class="fas fa-file-alt"></i><h3>Your Resume Appears Here</h3><p>Start chatting with the AI to build your resume. It updates in real-time!</p></div>`;
  }

  switch (tmpl) {
    case 'classic': return buildClassic();
    case 'minimal': return buildMinimal();
    case 'creative': return buildCreative();
    default: return buildModern();
  }
}

function buildModern() {
  const d = resumeData;
  return `<div class="resume-modern">
    <div class="r-header">
      <div class="r-name">${d.name || 'Your Name'}</div>
      <div class="r-title">${d.title || 'Your Title'}</div>
      <div class="r-contact">
        ${d.email ? `<span>✉ ${d.email}</span>` : ''}
        ${d.phone ? `<span>📞 ${d.phone}</span>` : ''}
        ${d.location ? `<span>📍 ${d.location}</span>` : ''}
        ${d.linkedin ? `<span>💼 ${d.linkedin}</span>` : ''}
        ${d.github ? `<span>🐙 ${d.github}</span>` : ''}
      </div>
    </div>
    <div class="r-body">
      ${!hiddenSections.has('summary') && d.summary ? `
      <div class="r-section">
        <div class="r-section-title">Professional Summary</div>
        <div class="r-summary">${d.summary}</div>
      </div>` : ''}

      ${!hiddenSections.has('experience') && d.experience.length > 0 ? `
      <div class="r-section">
        <div class="r-section-title">Work Experience</div>
        ${d.experience.map(e => `
        <div class="r-exp-item">
          <div class="r-exp-header">
            <div class="r-exp-company">${e.company}</div>
            <div class="r-exp-dates">${e.dates}</div>
          </div>
          <div class="r-exp-role">${e.role}</div>
          ${e.bullets.length > 0 ? `<ul class="r-exp-bullets">${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}
        </div>`).join('')}
      </div>` : ''}

      ${!hiddenSections.has('education') && d.education.length > 0 ? `
      <div class="r-section">
        <div class="r-section-title">Education</div>
        ${d.education.map(e => `
        <div class="r-edu-item">
          <div>
            <div class="r-edu-school">${e.school}</div>
            <div class="r-edu-degree">${e.degree}${e.field ? ' — ' + e.field : ''}${e.gpa ? ' | GPA: ' + e.gpa : ''}</div>
          </div>
          <div class="r-edu-date">${e.dates}</div>
        </div>`).join('')}
      </div>` : ''}

      ${!hiddenSections.has('skills') && d.skills.length > 0 ? `
      <div class="r-section">
        <div class="r-section-title">Skills</div>
        <div class="r-skills-grid">
          ${d.skills.map(s => `<span class="r-skill-tag">${s}</span>`).join('')}
        </div>
      </div>` : ''}

      ${!hiddenSections.has('projects') && d.projects.length > 0 ? `
      <div class="r-section">
        <div class="r-section-title">Projects</div>
        ${d.projects.map(p => `
        <div class="r-proj-item">
          <div class="r-proj-name">${p.name}</div>
          <div class="r-proj-desc">${p.desc}</div>
          ${p.tech.length > 0 ? `<div class="r-proj-tech">${p.tech.map(t => `<span class="r-tech-tag">${t}</span>`).join('')}</div>` : ''}
        </div>`).join('')}
      </div>` : ''}

      ${!hiddenSections.has('certifications') && d.certifications.length > 0 ? `
      <div class="r-section">
        <div class="r-section-title">Certifications</div>
        ${d.certifications.map(c => `
        <div class="r-cert-item">
          <span><strong class="r-cert-name">${c.name}</strong>${c.org ? ' — ' + c.org : ''}</span>
          <span class="r-cert-org">${c.date}</span>
        </div>`).join('')}
      </div>` : ''}
    </div>
  </div>`;
}

function buildClassic() {
  const d = resumeData;
  return `<div class="resume-classic">
    <div class="r-name">${d.name || 'Your Name'}</div>
    <div class="r-title">${d.title || ''}</div>
    <div class="r-contact">
      ${d.email ? `<span>${d.email}</span>` : ''}
      ${d.phone ? `<span>${d.phone}</span>` : ''}
      ${d.location ? `<span>${d.location}</span>` : ''}
      ${d.linkedin ? `<span>${d.linkedin}</span>` : ''}
    </div>
    <hr class="r-divider">
    ${!hiddenSections.has('summary') && d.summary ? `<div class="r-section"><div class="r-section-title">Summary</div><div class="r-summary">${d.summary}</div></div>` : ''}
    ${!hiddenSections.has('experience') && d.experience.length > 0 ? `<div class="r-section"><div class="r-section-title">Experience</div>${d.experience.map(e => `<div class="r-exp-item"><div class="r-exp-header"><strong class="r-exp-company">${e.company}</strong><span class="r-exp-dates">${e.dates}</span></div><div class="r-exp-role">${e.role}</div>${e.bullets.length > 0 ? `<ul class="r-exp-bullets">${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>` : ''}
    ${!hiddenSections.has('education') && d.education.length > 0 ? `<div class="r-section"><div class="r-section-title">Education</div>${d.education.map(e => `<div class="r-edu-item"><div class="r-edu-school">${e.school}</div><div class="r-edu-degree">${e.degree}${e.field ? ' - ' + e.field : ''}</div><div class="r-edu-date">${e.dates}</div></div>`).join('')}</div>` : ''}
    ${!hiddenSections.has('skills') && d.skills.length > 0 ? `<div class="r-section"><div class="r-section-title">Skills</div><div class="r-skills-grid">${d.skills.map(s => `<span class="r-skill-tag">${s}</span>`).join('')}</div></div>` : ''}
    ${!hiddenSections.has('projects') && d.projects.length > 0 ? `<div class="r-section"><div class="r-section-title">Projects</div>${d.projects.map(p => `<div class="r-proj-item"><div class="r-proj-name">${p.name}</div><div class="r-proj-desc">${p.desc}</div>${p.tech.length > 0 ? `<em style="font-size:12px;color:#888">${p.tech.join(', ')}</em>` : ''}</div>`).join('')}</div>` : ''}
    ${!hiddenSections.has('certifications') && d.certifications.length > 0 ? `<div class="r-section"><div class="r-section-title">Certifications</div>${d.certifications.map(c => `<div class="r-cert-item"><span>${c.name}${c.org ? ' — ' + c.org : ''}</span><span>${c.date}</span></div>`).join('')}</div>` : ''}
  </div>`;
}

function buildMinimal() {
  const d = resumeData;
  return `<div class="resume-minimal">
    <div class="r-name">${d.name || 'Your Name'}</div>
    <div class="r-title">${d.title || ''}</div>
    <div class="r-contact">
      ${d.email ? `<span>${d.email}</span>` : ''}
      ${d.phone ? `<span>${d.phone}</span>` : ''}
      ${d.location ? `<span>${d.location}</span>` : ''}
      ${d.linkedin ? `<span>${d.linkedin}</span>` : ''}
    </div>
    <div class="r-line"></div>
    ${!hiddenSections.has('summary') && d.summary ? `<div class="r-section"><div class="r-section-title">About</div><div><div class="r-summary">${d.summary}</div></div></div>` : ''}
    ${!hiddenSections.has('experience') && d.experience.length > 0 ? `<div class="r-section"><div class="r-section-title">Experience</div><div>${d.experience.map(e => `<div class="r-exp-item"><div class="r-exp-company">${e.company}</div><div class="r-exp-role">${e.role}</div><div class="r-exp-dates">${e.dates}</div>${e.bullets.length > 0 ? `<ul class="r-exp-bullets">${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div></div>` : ''}
    ${!hiddenSections.has('education') && d.education.length > 0 ? `<div class="r-section"><div class="r-section-title">Education</div><div>${d.education.map(e => `<div class="r-edu-item"><div class="r-edu-school">${e.school}</div><div class="r-edu-degree">${e.degree}${e.field ? ' — ' + e.field : ''}</div><div class="r-edu-date">${e.dates}</div></div>`).join('')}</div></div>` : ''}
    ${!hiddenSections.has('skills') && d.skills.length > 0 ? `<div class="r-section"><div class="r-section-title">Skills</div><div class="r-skills-grid">${d.skills.map(s => `<span class="r-skill-tag">${s}</span>`).join('')}</div></div>` : ''}
    ${!hiddenSections.has('projects') && d.projects.length > 0 ? `<div class="r-section"><div class="r-section-title">Projects</div><div>${d.projects.map(p => `<div class="r-proj-item"><div class="r-proj-name">${p.name}</div><div class="r-proj-desc">${p.desc}</div>${p.tech.length > 0 ? `<small style="color:#888">${p.tech.join(' · ')}</small>` : ''}</div>`).join('')}</div></div>` : ''}
    ${!hiddenSections.has('certifications') && d.certifications.length > 0 ? `<div class="r-section"><div class="r-section-title">Certs</div><div>${d.certifications.map(c => `<div class="r-cert-item"><span>${c.name}${c.org ? ' — ' + c.org : ''}</span><span style="color:#aaa;font-size:11px">${c.date}</span></div>`).join('')}</div></div>` : ''}
  </div>`;
}

function buildCreative() {
  const d = resumeData;
  const skillLevels = { 'html': 90, 'css': 85, 'javascript': 88, 'python': 80, 'react': 82, 'node': 75, 'sql': 78, 'java': 70, 'c++': 72, 'machine learning': 76 };
  return `<div class="resume-creative">
    <div class="r-sidebar">
      <div class="r-avatar"><i class="fas fa-user"></i></div>
      <div class="r-name">${d.name || 'Your Name'}</div>
      <div class="r-title">${d.title || ''}</div>
      <div class="r-sidebar-section">
        <div class="r-sidebar-title">Contact</div>
        ${d.email ? `<div class="r-contact-item"><i class="fas fa-envelope" style="color:#6c63ff;font-size:10px"></i>${d.email}</div>` : ''}
        ${d.phone ? `<div class="r-contact-item"><i class="fas fa-phone" style="color:#6c63ff;font-size:10px"></i>${d.phone}</div>` : ''}
        ${d.location ? `<div class="r-contact-item"><i class="fas fa-map-marker-alt" style="color:#6c63ff;font-size:10px"></i>${d.location}</div>` : ''}
        ${d.linkedin ? `<div class="r-contact-item"><i class="fab fa-linkedin" style="color:#6c63ff;font-size:10px"></i>${d.linkedin}</div>` : ''}
      </div>
      ${!hiddenSections.has('skills') && d.skills.length > 0 ? `
      <div class="r-sidebar-section">
        <div class="r-sidebar-title">Skills</div>
        ${d.skills.slice(0, 8).map(s => {
    const lvl = skillLevels[s.toLowerCase()] || Math.floor(Math.random() * 25) + 70;
    return `<div class="r-skill-bar"><div class="r-skill-name"><span>${s}</span><span>${lvl}%</span></div><div class="r-skill-track"><div class="r-skill-fill" style="width:${lvl}%"></div></div></div>`;
  }).join('')}
      </div>` : ''}
      ${!hiddenSections.has('education') && d.education.length > 0 ? `
      <div class="r-sidebar-section">
        <div class="r-sidebar-title">Education</div>
        ${d.education.map(e => `<div style="margin-bottom:10px"><div style="font-size:12px;font-weight:700;color:white">${e.school}</div><div style="font-size:11px;color:#9999bb">${e.degree}${e.field ? ' — ' + e.field : ''}</div><div style="font-size:10px;color:#666">${e.dates}</div></div>`).join('')}
      </div>` : ''}
    </div>
    <div class="r-main">
      ${!hiddenSections.has('summary') && d.summary ? `<div class="r-section"><div class="r-section-title">About Me</div><div class="r-summary">${d.summary}</div></div>` : ''}
      ${!hiddenSections.has('experience') && d.experience.length > 0 ? `<div class="r-section"><div class="r-section-title">Experience</div>${d.experience.map(e => `<div class="r-exp-item"><div class="r-exp-company">${e.company}</div><div class="r-exp-role">${e.role}</div><div class="r-exp-dates">${e.dates}</div>${e.bullets.length > 0 ? `<ul class="r-exp-bullets">${e.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : ''}</div>`).join('')}</div>` : ''}
      ${!hiddenSections.has('projects') && d.projects.length > 0 ? `<div class="r-section"><div class="r-section-title">Projects</div>${d.projects.map(p => `<div class="r-proj-item"><div class="r-proj-name">${p.name}</div><div class="r-proj-desc">${p.desc}</div>${p.tech.length > 0 ? `<small style="color:#888;font-size:11px">${p.tech.join(' · ')}</small>` : ''}</div>`).join('')}</div>` : ''}
      ${!hiddenSections.has('certifications') && d.certifications.length > 0 ? `<div class="r-section"><div class="r-section-title">Certifications</div>${d.certifications.map(c => `<div class="r-cert-item"><strong>${c.name}</strong>${c.org ? ' — ' + c.org : ''} <em style="color:#888;font-size:11px">${c.date}</em></div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

// ===== UTILITIES =====
function parseEducation(text) {
  // Pattern: "B.Tech Computer Science from XYZ University, 2020-2024, GPA 8.5"
  const gpaMatch = text.match(/gpa[:\s]*([\d.]+)/i);
  const dateMatch = text.match(/(\d{4})\s*[-–to]+\s*(\d{4}|present)/i) || text.match(/(\d{4})/);
  const fromMatch = text.match(/from\s+(.+?)(?:,|\d|$)/i);
  const degreeMatch = text.match(/^(b\.?tech|b\.?sc|b\.?e|m\.?tech|m\.?sc|b\.?a|m\.?a|ph\.?d|mba|diploma|12th|10th|bachelor|master|associate)[^,]*/i);

  return {
    school: fromMatch ? fromMatch[1].trim() : text.split(/,|from/i)[0].trim(),
    degree: degreeMatch ? degreeMatch[0].trim() : text.split(/,/)[0].trim(),
    field: '',
    dates: dateMatch ? dateMatch[0] : '',
    gpa: gpaMatch ? gpaMatch[1] : ''
  };
}

function updateStep(n) {
  document.querySelectorAll('.step').forEach((s, i) => {
    if (i + 1 < n) s.classList.add('done');
    else s.classList.remove('done');
    if (i + 1 === n) s.classList.add('active');
    else s.classList.remove('active');
  });
}

function jumpToStep(n) {
  const stepMap = { 1: 'name', 2: 'exp_start', 3: 'skills', 4: 'done' };
  chatStep = stepMap[n] || chatStep;
  updateStep(n);
  addBotMessage(`Jumping to step ${n}. What would you like to update?`);
}

function updateAtsScore(forced = null) {
  let score = forced;
  if (!score) {
    let pts = 0;
    if (resumeData.name) pts += 10;
    if (resumeData.email) pts += 10;
    if (resumeData.phone) pts += 5;
    if (resumeData.summary && resumeData.summary.length > 50) pts += 20;
    if (resumeData.experience.length > 0) pts += 20;
    if (resumeData.education.length > 0) pts += 10;
    if (resumeData.skills.length >= 5) pts += 15;
    if (resumeData.projects.length > 0) pts += 5;
    if (resumeData.certifications.length > 0) pts += 5;
    score = pts;
  }
  document.getElementById('atsFill').style.width = score + '%';
  document.getElementById('atsScore').textContent = score + '%';
  let label = 'Start building';
  if (score >= 80) label = 'Excellent! ATS Ready 🎉';
  else if (score >= 60) label = 'Good - Almost there!';
  else if (score >= 40) label = 'Fair - Keep going!';
  else if (score > 0) label = 'Getting started...';
  document.getElementById('atsLabel').textContent = label;
}

function saveProgress() {
  localStorage.setItem('resume_builder_data', JSON.stringify(resumeData));
  localStorage.setItem('resume_builder_template', currentTemplate);
  showToast('✅ Progress saved to browser!', 'success');
}

function loadSaved() {
  const saved = localStorage.getItem('resume_builder_data');
  const savedTmpl = localStorage.getItem('resume_builder_template');
  if (saved) { try { resumeData = JSON.parse(saved); } catch (e) { } }
  if (savedTmpl) { currentTemplate = savedTmpl; document.getElementById('templateSelect').value = savedTmpl; }
}

function showToast(msg, type = '') {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.className = `toast ${type} show`;
  setTimeout(() => { toast.className = 'toast'; }, 3000);
}

function downloadPDF() {
  showToast('📥 Generating PDF...', '');
  const paper = document.getElementById('resumePaper');
  const origTransform = paper.style.transform;
  paper.style.transform = 'scale(1)';
  const options = {
    margin: 0,
    filename: `${resumeData.name || 'Resume'}_Resume.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, letterRendering: true },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };
  html2pdf().set(options).from(paper).save().then(() => {
    paper.style.transform = origTransform;
    showToast('✅ PDF downloaded!', 'success');
  });
}

// Quick Fill Templates
function quickFill(type) {
  const templates = {
    fresher: {
      name: 'Alex Johnson', title: 'Software Engineer (Fresher)',
      email: 'alex.johnson@email.com', phone: '+91 9876543210', location: 'Bangalore, India',
      linkedin: 'linkedin.com/in/alexjohnson',
      summary: 'Motivated Computer Science graduate with strong foundations in software development. Passionate about building scalable web applications and solving complex problems. Quick learner with hands-on experience in Python, JavaScript, and React through academic projects.',
      experience: [],
      education: [{ school: 'XYZ Institute of Technology', degree: 'B.Tech', field: 'Computer Science', dates: '2020 – 2024', gpa: '8.5' }],
      skills: ['Python', 'JavaScript', 'React', 'HTML/CSS', 'SQL', 'Git', 'Node.js', 'Machine Learning'],
      projects: [{ name: 'AI Resume Builder', desc: 'Built an AI-powered resume builder using Python Flask and React with Gemini API integration.', tech: ['Python', 'Flask', 'React', 'Gemini API'] }],
      certifications: [{ name: 'Python for Data Science', org: 'Coursera', date: '2023' }]
    },
    developer: {
      name: 'Sam Kumar', title: 'Full Stack Developer',
      email: 'sam.kumar@email.com', phone: '+91 9876543210', location: 'Hyderabad, India',
      linkedin: 'linkedin.com/in/samkumar',
      summary: 'Full Stack Developer with 3+ years of experience building robust web applications. Expertise in React, Node.js, and cloud technologies. Delivered 10+ production applications serving 100K+ users.',
      experience: [
        { company: 'TechCorp Solutions', role: 'Software Engineer', dates: '2022 – Present', bullets: ['Led development of microservices architecture reducing system latency by 40%', 'Built React dashboard used by 50,000+ daily active users', 'Mentored 3 junior developers and conducted code reviews'] },
        { company: 'StartupXYZ', role: 'Frontend Developer', dates: '2021 – 2022', bullets: ['Developed responsive UI components using React and TypeScript', 'Improved page load speed by 60% through code optimization'] }
      ],
      education: [{ school: 'JNTU University', degree: 'B.Tech', field: 'Computer Science', dates: '2017 – 2021', gpa: '7.8' }],
      skills: ['React', 'Node.js', 'TypeScript', 'Python', 'AWS', 'MongoDB', 'PostgreSQL', 'Docker', 'GraphQL'],
      projects: [{ name: 'E-Commerce Platform', desc: 'Full-stack e-commerce app with payment integration and admin dashboard.', tech: ['React', 'Node.js', 'MongoDB', 'Stripe'] }],
      certifications: [{ name: 'AWS Certified Developer', org: 'Amazon', date: '2023' }]
    },
    designer: {
      name: 'Priya Sharma', title: 'UI/UX Designer',
      email: 'priya.sharma@email.com', phone: '+91 9876543210', location: 'Mumbai, India',
      linkedin: 'linkedin.com/in/priyasharma',
      summary: 'Creative UI/UX Designer with 4+ years crafting user-centered digital experiences. Skilled in design thinking, prototyping, and user research. Increased user engagement by 35% through data-driven design decisions.',
      experience: [{ company: 'Design Studio Co.', role: 'Senior UI/UX Designer', dates: '2021 – Present', bullets: ['Designed and shipped 20+ product features with cross-functional teams', 'Conducted 50+ user interviews to drive design decisions', 'Created design system used across 5 product teams'] }],
      education: [{ school: 'National Design Institute', degree: 'B.Des', field: 'Visual Communication', dates: '2018 – 2022', gpa: '9.0' }],
      skills: ['Figma', 'Adobe XD', 'Sketch', 'Prototyping', 'User Research', 'Design Systems', 'Illustrator', 'After Effects'],
      projects: [{ name: 'Banking App Redesign', desc: 'Redesigned mobile banking app increasing user retention by 42%.', tech: ['Figma', 'Prototyping', 'User Testing'] }],
      certifications: [{ name: 'Google UX Design Certificate', org: 'Google', date: '2022' }]
    },
    manager: {
      name: 'Rahul Mehta', title: 'Product Manager',
      email: 'rahul.mehta@email.com', phone: '+91 9876543210', location: 'Delhi, India',
      linkedin: 'linkedin.com/in/rahulmehta',
      summary: 'Experienced Product Manager with 6+ years driving product strategy and roadmap execution. Track record of launching 10+ products that generated $5M+ in revenue. Strong cross-functional leadership and data-driven decision making.',
      experience: [{ company: 'Enterprise Solutions Ltd.', role: 'Senior Product Manager', dates: '2020 – Present', bullets: ['Led product roadmap for SaaS platform with 200K+ active users', 'Increased MRR by 45% through strategic feature prioritization', 'Managed team of 15 engineers, designers, and QA engineers'] }],
      education: [{ school: 'IIM Ahmedabad', degree: 'MBA', field: 'Product Management', dates: '2016 – 2018', gpa: '8.2' }],
      skills: ['Product Strategy', 'Roadmap Planning', 'Agile/Scrum', 'SQL', 'User Research', 'A/B Testing', 'JIRA', 'Data Analytics'],
      projects: [],
      certifications: [{ name: 'Product Management Certification', org: 'Product School', date: '2021' }]
    }
  };
  if (templates[type]) {
    resumeData = { ...resumeData, ...templates[type] };
    renderResume(); updateAtsScore();
    addBotMessage(`✅ **${type.charAt(0).toUpperCase() + type.slice(1)} template loaded!** Your resume preview is updated. You can now ask me to customize any section!`);
    showToast(`${type} template loaded!`, 'success');
  }
}