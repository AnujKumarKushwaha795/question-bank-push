Let me check the actual scripts and question format to give you accurate commands:

Viewed addQuestion.js:1-99
Viewed question_formate2.json:1-800
Viewed package.json:1-17

I can see your exact question format from the open file. Here's the complete upload guide:

---

## Adding New Questions — Commands

All commands run from `D:\pdf_to_latex\question-bank\`

### **Option 1: Import a whole paper (JSON array file)** ✅ Recommended

If you have a file like `question_formate2.json` with an array of questions:

```powershell
cd D:\pdf_to_latex\question-bank
node scripts/importQuestions.js D:\pdf_to_latex\question-deck\data\question_formate2.json
```

After import, push to GitHub:
```powershell
git add data/questions/
git commit -m "add: jee-main 2026 january morning shift"
git push origin main

npm run rebuild
git add data/indexes/ data/hierarchy/
git commit -m "rebuild: indexes after adding 2026 january paper"
git push origin main
```

---

### **Option 2: Add a single question**

Paste the JSON of one question, then press **Ctrl+D**:

```powershell
cd D:\pdf_to_latex\question-bank
npm run add
```

Or pipe it directly:
```powershell
Get-Content "D:\path\to\single_question.json" | node scripts/addQuestion.js
```

This auto-rebuilds indexes and commits are still needed after.

---

### **Your question JSON format** (from `question_formate2.json`)

```json
{
  "id": "unique-id-here",
  "exam": "jee-main",
  "subject": "mathematics",
  "chapter": "definite-integration",
  "topic": "properties-of-definite-integration",
  "paperId": "jee-main-2026-online-23rd-january-morning-shift",
  "paperTitle": "JEE Main 2026 (Online) 23rd January Morning Shift",
  "questionType": "single-select",
  "question_text": "<div><p>Question text with $$LaTeX$$</p></div>",
  "options": {
    "A": "<p>Option A</p>",
    "B": "<p>Option B</p>",
    "C": "<p>Option C</p>",
    "D": "<p>Option D</p>"
  },
  "correct_answer": "A",
  "difficulty": "medium",
  "totalMarks": 4,
  "negativeMarks": 1,
  "year": 2026
}
```

**Required fields:** `id`, `exam`, `subject`, `chapter`, `topic`, `paperId`, `paperTitle`, `questionType`, `question_text`, `correct_answer`, `year`

**Valid values:**
| Field | Valid values |
|---|---|
| `exam` | `jee-main`, `jee-advanced`, `neet` |
| `subject` | `physics`, `chemistry`, `mathematics`, `biology` |
| `questionType` | `single-select`, `multiple-select`, `integer`, `match`, `subjective`, `true-false` |
| `difficulty` | `easy`, `medium`, `hard` |

### **Typical full workflow for a new paper:**
```powershell
cd D:\pdf_to_latex\question-bank

# 1. Import
node scripts/importQuestions.js "D:\path\to\new_paper.json"

# 2. Rebuild indexes
npm run rebuild

# 3. Push everything
git add .
git commit -m "add: jee-main 2027 april evening shift (90 questions)"
git push origin main
```

CDN updates automatically within ~5 minutes. Your webpage will show the new chapter/paper immediately.













