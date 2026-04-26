🤖 AI Resume Builder (Gemini Powered)

An AI-powered Resume Builder developed as part of the INT-428: AI Essentials course.
This application helps users create professional, ATS-optimized resumes using AI, chatbot interaction, and job description-based customization.

🌐 Live Demo: https://ai-resume-builder-z6hx.onrender.com


📌 Project Overview

This project leverages Artificial Intelligence to automate and enhance resume creation.
Users can interact with an AI chatbot to build resumes step-by-step, analyze job descriptions, and tailor resumes for better job matching.


✨ Key Features

    🤖 AI-Powered Resume Generation

      * Generates professional summaries
      * Creates impactful experience bullet points
      * Improves resume sections using AI

🎯 Job Description-Based Resume Tailoring (🔥 Highlight Feature)

    * Accepts job description input
    * Extracts relevant keywords
    * Matches resume content with job requirements
    * Suggests missing skills
    * Improves summary according to job role

📊 ATS Optimization

    * Calculates ATS score
    * Provides improvement tips
    * Enhances keyword matching

💬 Chat-Based Resume Builder

    * Interactive chatbot interface
    * Step-by-step resume creation
    * Real-time AI guidance

📄 Resume Tools

    * Live preview panel
    * Multiple templates (Modern, Classic, Minimal, Creative)
    * Download resume as PDF


🛠️ Tech Stack

Frontend

    * HTML, CSS, JavaScript
    * Responsive UI design
    * HTML2PDF library

Backend

    * Python (Flask) 
    * REST API architecture

AI Integration

    * Google Gemini API 

📂 Project Structure

    ```id="k8v3xw"
    ai-resume-builder/
    │
    ├── app.py              # Flask backend (AI APIs)
    ├── index.html          # Frontend UI
    ├── style.css           # Styling
    ├── script.js           # Logic & AI integration
    ├── requirement.txt     # Dependencies
    ├── .gitignore          # Ignore sensitive files (.env)
    ├── .env                # Environment variables (not pushed)
    ├── README.md
```

⚙️ Setup Instructions

1️⃣ Clone Repository

    ```id="x1c7kp"
    git clone https://github.com/your-username/ai-resume-builder.git
    cd ai-resume-builder
    ```


2️⃣ Install Dependencies

    ```id="d4p9lm"
    pip install -r requirement.txt
    ```


3️⃣ Configure Environment Variables

    Create `.env` file:

    ```id="r7n2zq"
    GEMINI_API_KEY=your_api_key_here
    ```


4️⃣ Run Backend

    ```id="v6q8yb"
   python app.py
   ```

   Server:

    ```id="z5m2ox"
    http://localhost:5000
    ```


5️⃣ Run Frontend

    Open:

    ```id="w3e9sj"
    index.html
    ```

---

🌐 Deployment

   * Frontend/Backend: Render 


🔒 Security

Sensitive data (API keys) are stored in `.env` and excluded using `.gitignore`.


🎓 Academic Context

    Developed as part of **INT-428: AI Essentials** to demonstrate real-world AI application in resume optimization and automation.


👨‍💻 Author

   **Aditya Kumar**
   B.Tech CSE Student


⭐ Support

    If you like this project, give it a ⭐ on GitHub!
