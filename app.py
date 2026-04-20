from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import os
import json
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)

# Configure Gemini
GEMINI_API_KEY = os.getenv('GEMINI_API_KEY', '')
if GEMINI_API_KEY:
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel('gemini-3-flash-preview')
else:
    model = None

# ========== ROUTES ==========

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

@app.route('/api/generate-summary', methods=['POST'])
def generate_summary():
    """Generate professional summary using Gemini AI"""
    data = request.json
    name = data.get('name', '')
    title = data.get('title', '')
    description = data.get('description', '')
    
    if not model:
        return jsonify({'error': 'No API key configured'}), 400
    
    prompt = f"""Write a professional resume summary (3 sentences, 60-80 words) for:
Name: {name}
Title: {title}
Description: {description}
Make it ATS-friendly, achievement-focused, and compelling. Return ONLY the summary."""
    
    try:
        response = model.generate_content(prompt)
        return jsonify({'summary': response.text.strip()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate-bullets', methods=['POST'])
def generate_bullets():
    """Generate professional bullet points for work experience"""
    data = request.json
    role = data.get('role', '')
    company = data.get('company', '')
    description = data.get('description', '')
    
    if not model:
        return jsonify({'error': 'No API key configured'}), 400
    
    prompt = f"""Create 3-4 professional resume bullet points for a {role} at {company}.
User description: "{description}"
Use action verbs, quantify where possible, ATS-friendly.
Return ONLY bullet points, one per line, starting with •"""
    
    try:
        response = model.generate_content(prompt)
        bullets = [b.replace('•', '').replace('-', '').strip() 
                   for b in response.text.split('\n') if b.strip()]
        return jsonify({'bullets': [b for b in bullets if len(b) > 10]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/suggest-skills', methods=['POST'])
def suggest_skills():
    """Suggest relevant skills based on job role"""
    data = request.json
    role = data.get('role', '')
    existing = data.get('existing', [])
    
    if not model:
        return jsonify({'skills': []}), 200
    
    prompt = f"""Suggest 8 in-demand skills for a {role}.
Existing skills: {', '.join(existing)}
Return ONLY new skills not in the existing list, comma-separated, no extra text."""
    
    try:
        response = model.generate_content(prompt)
        skills = [s.strip() for s in response.text.split(',') if s.strip()]
        new_skills = [s for s in skills if s.lower() not in [e.lower() for e in existing]]
        return jsonify({'skills': new_skills[:8]})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/analyze-jd', methods=['POST'])
def analyze_jd():
    """Analyze job description and extract keywords"""
    data = request.json
    jd = data.get('jd', '')
    resume = data.get('resume', {})
    
    if not model:
        return jsonify({'error': 'No API key configured'}), 400
    
    prompt = f"""Extract key skills and keywords from this job description for resume optimization:
"{jd[:1500]}"
Return max 15 items, comma-separated."""
    
    try:
        response = model.generate_content(prompt)
        keywords = [k.strip() for k in response.text.split(',') if k.strip()]
        
        # Also improve summary
        summary_prompt = f"""Rewrite this professional summary to match this job:
Summary: "{resume.get('summary', '')}"
Job: "{jd[:500]}"
Keep under 80 words, ATS-friendly. Return ONLY the summary."""
        
        summary_response = model.generate_content(summary_prompt)
        
        return jsonify({
            'keywords': keywords[:15],
            'improved_summary': summary_response.text.strip()
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/improve-section', methods=['POST'])
def improve_section():
    """Improve any resume section using AI"""
    data = request.json
    section = data.get('section', '')
    content = data.get('content', '')
    title = data.get('title', '')
    
    if not model:
        return jsonify({'error': 'No API key configured'}), 400
    
    prompt = f"""Improve this resume {section} for a {title}:
"{content}"
Make it more impactful, ATS-friendly, and compelling (under 80 words).
Return ONLY improved text."""
    
    try:
        response = model.generate_content(prompt)
        return jsonify({'improved': response.text.strip()})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/ats-check', methods=['POST'])
def ats_check():
    """Perform ATS compatibility check"""
    data = request.json
    resume = data.get('resume', {})
    jd = data.get('jd', '')
    
    if not model:
        return jsonify({'error': 'No API key configured'}), 400
    
    prompt = f"""Analyze this resume for ATS compatibility and provide 5 specific improvement tips:
Resume:
- Name: {resume.get('name','')}
- Title: {resume.get('title','')}
- Summary: {resume.get('summary','')}
- Skills: {', '.join(resume.get('skills', []))}
- Experience: {len(resume.get('experience', []))} positions
{f'Job Description: {jd[:500]}' if jd else ''}

Format as numbered list of actionable tips."""
    
    try:
        response = model.generate_content(prompt)
        return jsonify({'tips': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/chat', methods=['POST'])
def chat():
    """General AI chat endpoint"""
    data = request.json
    message = data.get('message', '')
    resume_data = data.get('resume', {})
    history = data.get('history', [])
    
    if not model:
        return jsonify({'error': 'No API key configured'}), 400
    
    system_ctx = f"""You are ResumeAI, a helpful AI resume building assistant.
Current resume: {json.dumps(resume_data, indent=2)}
Help the user build and improve their resume. Be concise (under 100 words per response)."""
    
    try:
        chat_session = model.start_chat(history=[])
        response = chat_session.send_message(f"{system_ctx}\n\nUser: {message}")
        return jsonify({'response': response.text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/generate', methods=['POST'])
def generate():
    """Generic Gemini prompt endpoint — used by the frontend for all AI calls"""
    data = request.json
    prompt = data.get('prompt', '').strip()

    if not prompt:
        return jsonify({'error': 'No prompt provided'}), 400

    if not model:
        return jsonify({'error': 'No API key configured on the server. Add GEMINI_API_KEY to .env'}), 503

    try:
        response = model.generate_content(
            prompt,
            generation_config={"temperature": 0.7, "max_output_tokens": 800}
        )
        return jsonify({'text': response.text.strip()})
    except Exception as e:
        err = str(e)
        if '429' in err or 'quota' in err.lower():
            return jsonify({'error': 'API quota exceeded. Please try again later.'}), 429
        return jsonify({'error': err}), 500


@app.route('/api/save-resume', methods=['POST'])
def save_resume():
    """Save resume data to file"""
    data = request.json
    with open('saved_resume.json', 'w') as f:
        json.dump(data, f, indent=2)
    return jsonify({'status': 'saved'})


@app.route('/api/load-resume', methods=['GET'])
def load_resume():
    """Load saved resume data"""
    try:
        with open('saved_resume.json', 'r') as f:
            data = json.load(f)
        return jsonify(data)
    except FileNotFoundError:
        return jsonify({})


if __name__ == "__main__":
    print("=" * 50)
    print("  AI Resume Builder - Flask Backend")
    print("=" * 50)
    print(f"  Gemini API: {'✓ Configured' if GEMINI_API_KEY else '✗ Not set'}")
    print("=" * 50)

    port = int(os.environ.get("PORT", 10000))
    app.run(host="0.0.0.0", port=port)