# Project Specification: Serverless Adaptive Learning Engine (Project "Sprout")

**Role:** Principal Architect
**Objective:** Build a serverless, event-driven system that aggregates unstructured daily feedback logs to generate personalized, development-focused weekly plans using LLMs.

---

## 1. High-Level Architecture

The system follows a **"Split-Brain" Architecture** to decouple user interaction from heavy compute tasks.

### The Diagram

```mermaid
graph TD
    User((You)) -->|1. Type Natural Text| UI[Next.js Dashboard 'Smart Input']
    UI -->|2. Extract JSON Data| AI_Front[OpenRouter API]
    UI -->|3. Store Structured Data| DDB[(AWS DynamoDB)]
    UI -->|4. Click 'Generate Weekly Plan'| API[Next.js API Route]
    API -->|5. Invoke Async| Lambda[AWS Lambda TypeScript Nodejs22x]
    
    Scheduler[EventBridge Scheduler] -->|6. Trigger (Sunday 8AM, later)| Lambda
    
    Lambda -->|7. Fetch Logs & Profile| DDB
    Lambda -->|8. Fetch Research| S3[(S3 Knowledge Base)]
    Lambda -->|9. Synthesize Weekly Plan| AI_Back[OpenRouter API]
    Lambda -->|10. Write Markdown Artifact| S3
    Lambda -->|11. Deliver Plan (optional)| SES[Amazon SES]
    SES -->|12. Email Notification| User

```

## 2. Data Design (Single Table Strategy)

We will use **AWS DynamoDB** with a flexible Single Table Design (STD).

**Table Name:** `Sprout_Data`
**Capacity:** On-Demand (Free Tier optimized)

| Entity | Partition Key (PK) | Sort Key (SK) | Attributes (JSON extracted via LLM) |
| --- | --- | --- | --- |
| **Child Profile** | `USER#Yumi` | `PROFILE` | `birth_date` (String, `YYYY-MM-DD`), `milestones` (List), `schemas` (List), `interests` (List) |
| **Daily Log** | `LOG#Yumi` | `DATE#2026-02-12` | `raw_text` (String), `key_takeaways` (List), `sentiment` (String) |
| **Weekly Plan Job Status (optional, later)** | `PLAN_JOB#Yumi` | `JOB#<requestId>` | `status` (String), `startedAt` (String), `completedAt` (String), `outputObjectKey` (String), `errorMessage` (String) |

**S3 Storage Strategy**

* **Bucket:** `sprout-knowledge-base`
* **Structure:**
  * `/development_guides` (reference markdown files, including `baby-development-report.md`)
  * `/plans` (generated weekly plan markdown files, for example `plans/Yumi/2026-02-16.md`)

**Profile Age Strategy**

* Persist `birth_date` as the source of truth in DynamoDB.
* Derive `ageMonths` at read-time in the backend/frontend so age stays current automatically.

---

## 3. Interface & UX Specification (Next.js)

The frontend acts as the "Control Plane" and relies on AI for frictionless data entry.

### Core Features

1. **The "Smart Input" (LLM Structured Extraction):**
* **UX:** A single text box where the user brain-dumps the day's events (e.g., "Yumi loved the sensory bin today but got mad during tummy time").
* **Backend:** Next.js API route (`/api/logs`) sends this raw text to OpenRouter. The LLM is strictly prompted to return a JSON object categorizing the input into "Daily Log" data and identifying any new "Profile Updates" (milestones hit).
* **Storage:** Saves the clean JSON directly to DynamoDB.

2. **The Profile State:** View of the child's current milestones and schemas, fetched from DynamoDB.
3. **The Play Plan:** A component-driven UI that fetches the most recent weekly plan markdown artifact from S3 (default: latest by `LastModified`) and maps headings/sections into interactive UI cards.

### Security Strategy (The Bouncer & Display Case)

To protect personal data while allowing recruiter access, we use **Next.js Middleware**.

* **The Bouncer (Admin Access):** User enters a passcode matching the `ADMIN_PASSCODE` env var through `/api/auth/login`. On success, the server issues a signed `sprout_session` HttpOnly cookie that enables real AWS-backed reads/writes.
* **The Display Case (Demo Mode):** Default visitors receive a `sprout_demo=true` HttpOnly cookie and stay in demo mode. API routes serve mock-style behavior and block database writes.
* **Defense in Depth:** Middleware resolves mode at the edge, and each API route re-checks mode before read/write execution (`authenticated`, `demo`, `unauthenticated`).

---

## 4. The Intelligence Engine (AWS Lambda)

This is the "Worker" that runs in the background. It is isolated from the frontend and supports two trigger modes:

1. **Manual trigger (now):** called by a Next.js API route from the Weekly Plan tab.
2. **Scheduled trigger (later):** called by EventBridge on a weekly cadence.

### Logic Flow

1. **Wake Up:** Triggered by Next.js API (manual) or EventBridge Scheduler (scheduled).
2. **Context Assembly:**
* Query DynamoDB for `USER#Yumi` (Current Profile).
* Query DynamoDB for `LOG#Yumi` where date is > (Today - 7 days).
3. **Fetch Research:**
* Pull relevant developmental stage guidelines from S3 Knowledge Base.
4. **Prompt Engineering:**
* Loads the canonical prompt template from S3 at `prompts/create-weekly-plan-prompt.md`.
* Uses repo prompt content as fallback if S3 prompt read fails.
* Injects runtime context profile plus last 7 days logs plus development guides into the final model payload.
5. **Inference & Storage:**
* Sends payload to **OpenRouter** using model from environment variable (default v1 target: Gemini 3.1 Pro preview).
* Receives model output and writes a new markdown object to S3 under `plans/<childId>/` (append-only timestamped key, for example `plans/Yumi/2026-02-23T13-45-00Z.md`).
* The frontend reads the latest object by `LastModified` when no specific `objectKey` is requested.
6. **Delivery:**
* Optionally converts the generated markdown into an HTML email template.
* Uses **Amazon SES** to email the formatted weekly plan to the parent.


---

## 5. Security & Infrastructure

### IAM Roles (Least Privilege)

1. **Next.js App Role (Amplify):**
* Allow `PutItem/GetItem/UpdateItem` on `Sprout_Data`.
* Allow `InvokeFunction` on the weekly-plan Lambda for manual generation.
* (Later) Allow `UpdateSchedule` on EventBridge if scheduling controls are managed from the app.


2. **Lambda Worker Role:**
* Allow `Query` on `Sprout_Data` (Read profile + recent logs).
* Allow `GetObject` on `development_guides/` in S3.
* Allow `PutObject` on `plans/` in S3.
* Allow `SendEmail` on SES.



### Environment Variables

* **Next.js:** `DATA_MODE`, `REGION`, `DYNAMODB_TABLE`, `S3_WEEKLY_PLAN_BUCKET`, `S3_WEEKLY_PLAN_PREFIX`, `ADMIN_PASSCODE`, `SESSION_SECRET`, `SESSION_TTL_HOURS`, `SESSION_REMEMBER_TTL_DAYS`, `OPENROUTER_API_KEY`, `WEEKLY_PLAN_LAMBDA_FUNCTION_NAME`.
* **Lambda:** `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `DYNAMODB_TABLE`, `CHILD_ID`, `S3_BUCKET`, `S3_DEVELOPMENT_GUIDES_PREFIX`, `S3_PROMPT_KEY`, `S3_WEEKLY_PLANS_PREFIX`, `EMAIL_SOURCE`.

For Amplify-hosted Next.js SSR, treat Amplify Console variables as build-environment inputs and explicitly hand off required server runtime values during build (via `amplify.yml`) by writing an allowlisted set into `.env.production` before `next build`. This keeps SSR runtime access deterministic (`process.env` in API routes/server components) while preserving least-privilege control over which variables are exposed.

---

## 6. Execution Roadmap (Data First Strategy)

### Phase 1: The Data Foundation (Day 1)

* [x] Create DynamoDB Table (`Sprout_Data`) in AWS Console.

### Phase 2: The Interface & Extraction (Day 2-3)

* [ ] Initialize Next.js app and deploy to AWS Amplify Gen 2.
* [ ] Build the "Smart Input" UI component.
* [ ] Write `/api/logs` route to call OpenRouter for JSON extraction.
* [ ] Connect `/api/logs` to DynamoDB and verify data writes successfully.

### Phase 3: Authentication & Portfolio Polish (Day 4)

* [ ] Implement Next.js Middleware for the `ADMIN_PASSCODE`.
* [ ] Implement "Demo Mode" fallback for public portfolio viewers.

### Phase 4: The Brain (Day 5-6)

* [ ] Write TypeScript Lambda handler on Nodejs22.x to fetch 7 days of logs from DynamoDB.
* [ ] Load prompt from S3 key `prompts/create-weekly-plan-prompt.md` with local fallback.
* [ ] Connect Lambda to OpenRouter to synthesize weekly-plan markdown.
* [ ] Write markdown artifact to `plans/<childId>/` in S3.
* [ ] Expose manual trigger from Next.js API route (`POST /api/v1/weekly-plan/generate`).
* [ ] Add Weekly Plan UI button + polling to detect newly generated object.
* [ ] Keep SES disabled in v1 and enable later as optional extension.

### Phase 5: Automation (Day 7)

* [ ] Configure EventBridge Scheduler to trigger the same Lambda every Sunday.

### Deployment Approach Update

* [ ] Start with AWS CLI scripted deployment for fastest initial iteration.
* [ ] Add GitHub Actions CI CD after first stable manual flow, using OIDC to deploy without long lived AWS keys.

---

## 7. Portfolio Narrative (Resume Value)

**Project Title:** Serverless Adaptive Learning Engine (Sprout)
**One-Liner:** "An event-driven RAG system that orchestrates personalized development curriculums using AWS Lambda, DynamoDB, and LLMs."

**Key Talking Points:**

* **Architecture:** Decoupled the high-latency AI processing (Lambda) from the user-facing application (Next.js) using a Split-Brain model with manual API trigger now and EventBridge automation later.
* **Single Table Design (NoSQL):** Designed an efficient DynamoDB PK/SK strategy for profile and daily-log context retrieval powering weekly synthesis.
* **Structured AI Output:** Engineered a reliable pipeline that transforms unstructured logs and developmental research into consistent weekly-plan markdown artifacts for predictable frontend rendering.
* **Smart Extraction:** Replaced traditional form inputs with an LLM-powered extraction layer, converting unstructured user text into strict JSON for NoSQL storage.
* **Edge Security:** Implemented Next.js Edge Middleware to protect PII via passcode authentication while maintaining a stateless "Demo Mode" for public portfolio showcasing.
* **Cost Optimization:** Architected to run entirely within the AWS Free Tier using Lambda Layers and On-Demand DynamoDB Capacity.
