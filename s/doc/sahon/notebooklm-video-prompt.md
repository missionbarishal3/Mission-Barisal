# Google NotebookLM — ভিডিও তৈরির প্রম্পট

> **ব্যবহার:** এই প্রম্পটটা Google NotebookLM-এ (notebooklm.google.com) আপনার নোটবুকে দিন। আগে এই প্রজেক্টের সব ডকুমেন্ট (README, এই HTML পেজ, architecture docs, মনু ভাই.md) নোটবুকে সোর্স হিসেবে আপলোড করুন, তারপর নিচের প্রম্পটটা পেস্ট করুন। NotebookLM অডিও ওভারভিউ (ভিডিও/পডকাস্ট) বানিয়ে দেবে।

---

## প্রম্পট (Bengali):

```
তুমি একজন অভিজ্ঞ টেকনোলজি কমিউনিকেটর। আমার দেওয়া সব সোর্স ডকুমেন্ট পড়ে
"ZombieCoder Mission Barisal" নামের একটি মাল্টি-এজেন্ট AI কোডিং সিস্টেমের উপর
একটি শিক্ষামূলক ভিডিও স্ক্রিপ্ট তৈরি করো। ভিডিওটি যেন এমনভাবে হয় যেন
টেকনিক্যাল আর নন-টেকনিক্যাল — দুই ধরনের মানুষই বুঝতে পারে।

## ভিডিওর কাঠামো (৫ পর্ব):

### পর্ব ১ — শুরু (০-১ মিনিট)
- সহজ ভাষায় বলো: এটি কী? — VS Code-এর ভেতরে একটি চ্যাট বক্স যেখানে ৬ জন
  AI বিশেষজ্ঞ এজেন্ট (আর্কিটেক্ট, ডিবাগার, সিকিউরিটি, পারফরম্যান্স,
  ডকুমেন্টেশন, কোয়ালিটি) একসাথে কাজ করে।
- দর্শকের আগ্রহ ধরো: "কল্পনা করুন আপনার কোডিং পার্টনার এমন যে কখনো মিথ্যা
  বলে না — কারণ প্রমাণ ছাড়া কথা বলাই তার নিষেধ।"

### পর্ব ২ — সিস্টেম কীভাবে কাজ করে (১-৩ মিনিট)
- ধাপে ধাপে: ইউজার প্রশ্ন → এক্সটেনশন পরিষ্কার করে → SSOT + সিলেবাস +
  সেশন মেমোরি যোগ করে → সার্ভার শ্রেণিবিভাগ করে → উপযুক্ত এজেন্ট(রা)
  কাজ করে → প্রমাণ-দ্বার যাচাই করে → উত্তর ইউজারের কাছে।
- ৪ ধরনের পরিবহন (UDS, HTTP, SSE, WebSocket) — দ্রুততম পথে যোগাযোগ।
- ৩৫+ মডেলের চেইন — একটা ব্যর্থ হলে পরেরটা চেষ্টা করে।

### পর্ব ৩ — বাস্তব সমস্যা ও সমাধান (৩-৫ মিনিট)
- দেখাও: আগে ৭১টা টুল একসাথে পাঠানো হতো → ছোট মডেল ফাঁকা উত্তর দিত
  ("Tools provided: 71, Estimated input tokens: 50471")।
- দেখাও: সমাধান — টুল ৪০-এর কমে সীমিত (V1_TOOLS_CAPPED), স্মার্ট টুল
  নির্বাচন, খালি উত্তর এলে টুল ছাড়া আবার চেষ্টা।
- লাইভ প্রমাণ: ৭১টা টুল পাঠিয়ে টেস্ট — ২০৪ ক্যারেক্টারের উত্তর এলো, খালি না!
- ৪৯৬টা টেস্ট পাস, ০টা ফেল।

### পর্ব ৪ — নৈতিকতা, স্বচ্ছতা ও নির্ভুলতা (৫-৬ মিনিট)
- প্রমাণ-দ্বার: প্রমাণ ছাড়া কোনো উত্তর ইউজারের কাছে পৌঁছায় না।
- "আমার কাছে প্রমাণ নেই" বলা — মিথ্যা না বলে সত্য স্বীকার করা।
- সিলেবাসে শেখা: প্রতিবার কাজ থেকে শেখে, সিস্টেম যত চলে তত স্মার্ট হয়।
- গাণিতিক দিক: ১০% ভুলের মডেলও দুই এজেন্টের ক্রস-চেকে ৯৯% নির্ভুলতা দিতে
  পারে (0.1 × 0.1 = 0.01 ভুল)।

### পর্ব ৫ — সমাপ্তি (৬-৭ মিনিট)
- সংক্ষেপে: প্রযুক্তি যেন সবার বন্ধু হয়, শেখা যায়, স্বচ্ছ থাকে।
- আহ্বান: "প্রযুক্তি থেকে শিখুন, প্রযুক্তিকে শেখান — কারণ এই সিস্টেম
  প্রতিবার কাজ করার সাথে সাথে নিজেই আরও স্মার্ট হয়।"

## স্টাইল নির্দেশনা:
- ভাষা: সহজ, প্রাণবন্ত বাংলা (বরিশালি স্পর্শে মজার ছলে, কিন্তু পেশাদার)।
- উদাহরণ দিন: "যেমন ধরো, তুমি জিজ্ঞেস করলে 'এই ফাইলটায় বাগ কেন?' — তখন
  ডিবাগার এজেন্ট ফাইল খুলে, লাইন ধরে ধরে দেখে, প্রমাণসহ বলবে।"
- কোডের জটিলতা এড়িয়ে গল্পের মতো বলো। সংখ্যা/পরিসংখ্যান দাও কিন্তু
  সহজভাবে।
- ভিডিওর শেষে একটা শিরোনাম সাজেস্ট করো।
```

---

## বিকল্প: ইংরেজি প্রম্পট (English version):

```
You are an experienced technology communicator. Read all my source
documents and create an educational video script about
"ZombieCoder Mission Barisal" — a multi-agent AI coding system.
Make it understandable for BOTH technical and non-technical people.

Structure (5 parts):
1. Hook (0-1min): What is it? A VS Code chat with 6 AI specialist
   agents working together. "Imagine a coding partner that never
   lies — because speaking without proof is forbidden."
2. How it works (1-3min): User input → extension sanitizes →
   SSOT + syllabus + session memory → server classifies → agents
   work → evidence gate verifies → answer. 4 transports (UDS, HTTP,
   SSE, WebSocket). 35+ model provider chain with fallback.
3. Real problem & fix (3-5min): Before: 71 tools sent at once →
   small models returned EMPTY response ("Tools provided: 71,
   Estimated input tokens: 50471"). Fix: tools capped at 40
   (V1_TOOLS_CAPPED), smart tool selection, retry without tools.
   Live proof: 71 tools → 204-char response, not empty! 496 tests
   pass, 0 fail.
4. Ethics, transparency, accuracy (5-6min): Evidence gate — no
   unproven answer reaches the user. Honest "I have no proof".
   Syllabus learning. Math: 10% error model → 99% accuracy with
   two-agent cross-check (0.1 × 0.1 = 0.01 error).
5. Closing (6-7min): Technology as a friend — learn from it, teach
   it. Suggest a video title.

Style: simple, lively, story-like. Give relatable examples. Avoid
code jargon. End with a catchy title suggestion.
```
