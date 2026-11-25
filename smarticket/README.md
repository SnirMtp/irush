# SmarTicket – עמוד נחיתה Scrollytelling

## מבנה
```
smarticket/
├── index.html
├── assets/css/styles.css
├── assets/js/main.js          # GSAP + ScrollTrigger + scrubbing לווידאו
├── videos/                    # כאן נכנסים הסרטונים המכווצים
└── scripts/
    ├── compress-videos.sh     # כיווץ הסרטונים (FFmpeg)
    └── make-placeholders.sh   # סרטוני דמה לבדיקה
```

## הרצה מקומית
חובה להריץ דרך שרת מקומי ולא לפתוח את הקובץ ישירות (`file://`), אחרת הסרטונים לא נטענים כ-Blob והגלילה פחות חלקה.

```bash
cd smarticket
# 1. שמים את הסרטונים המקוריים בתיקייה raw/
mkdir -p raw   # scene1_chaos.mp4, scene2_transition.mp4, scene3_solution.mp4
# 2. מכווצים
./scripts/compress-videos.sh
# 3. מריצים שרת
python3 -m http.server 8080     # או: npx serve .
# 4. פותחים http://localhost:8080
```

אין סרטונים עדיין? `./scripts/make-placeholders.sh && ./scripts/compress-videos.sh` מייצר סרטוני דמה.

## חיבור הטופס
ב-`assets/js/main.js` מגדירים את `FORM_ENDPOINT` (POST עם JSON). כשהוא ריק, הטופס רץ במצב דמו ומציג הודעת הצלחה.
