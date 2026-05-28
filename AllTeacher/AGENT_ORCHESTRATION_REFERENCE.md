# Agent Orchestration Reference for AllTeacher
> Distilled from: https://quarkus.io/quarkus-workshop-langchain4j/
> Source: Section 2 — Agentic Workflows (Steps 1–4 + Conclusion)
> Purpose: Guide the redesign of AllTeacher's multi-agent pipeline

---

## Core Philosophy

### AI Services vs AI Agents

The workshop draws a sharp line between these two modes:

| Feature | AI Service | AI Agent |
|---|---|---|
| Purpose | Answer questions | Perform autonomous tasks |
| Interaction | Reactive (responds to prompts) | Reactive + Proactive (takes actions) |
| Tool usage | Can call tools | Calls tools to accomplish goals |
| Composition | Single-call interactions | Multi-agent workflows |
| Use cases | Chatbots, Q&A, content | Automation, decision-making, orchestration |

**AllTeacher implication:** Most of our agents (Assessor, Planner, Evaluator) are currently implemented as AI Services. They should become true Agents with tools and be composed into workflows.

---

## The 4 Fundamental Workflow Patterns

### 1. Sequential Workflow
Agents run **one after another**, each building on the previous agent's output (also called "Prompt Chaining").

```
Agent A → Agent B → Agent C
```

**Use when:** Each agent needs the output of the previous one.

**AllTeacher example:** `Assessor → Planner → ContentFetcher`

---

### 2. Parallel Workflow
Agents run **simultaneously** on separate threads. Results are collected before continuing.

```
       ┌─ Agent A ─┐
Input  ├─ Agent B  ─┤ → Combined Output
       └─ Agent C ─┘
```

**Use when:** Agents work independently and you want speed + aggregated results.

**AllTeacher example:** `ExerciseWriter + ProgressTracker` can run in parallel after an Evaluator pass — both read the same evaluation result and write to their own output keys.

**Performance note:** If each agent takes 2s, sequential = 4s, parallel = ~2s.

---

### 3. Conditional Workflow
Agents run **only when their activation condition is met** (boolean check on shared state).

```
Input → Condition? → Agent A (if true)
                  └→ Agent B (if different condition)
                  └→ Skip   (if no condition met)
```

**Use when:** Different paths are needed based on runtime data.

**AllTeacher example:**
- If `mastery_score < 0.4` on a topic → trigger `Adapter` to re-plan
- If `mastery_score >= 0.8` → skip Adapter, advance to next module

---

### 4. Loop Workflow
Agents run **repeatedly until a condition is met**.

```
Input → Agent → Continue? → Agent (repeat)
                         └→ Done
```

**Use when:** Iterative refinement is needed (with a max-iterations cap).

**AllTeacher example:** `ExerciseWriter` loop until a minimum of N non-seen exercises is generated for the session.

---

## Composing Workflows (Nesting)

Workflows can be **nested inside other workflows** at any depth:

```
MainWorkflow (Sequential)
├── FeedbackWorkflow (Parallel)    ← runs 3 agents simultaneously
│   ├── CleaningFeedbackAgent
│   ├── MaintenanceFeedbackAgent
│   └── DispositionFeedbackAgent
├── SupervisorAgent                ← AI-driven dynamic routing
└── ConditionSummaryAgent
```

**Key rule:** Use deterministic workflows (sequential/parallel/conditional) for predictable paths. Use supervisor for unpredictable, context-dependent paths.

---

## AgenticScope — The Shared State

**What it is:** A key-value map shared across all agents in a workflow execution. It's the mechanism agents use to pass data to each other without direct coupling.

**How it works:**

1. All inputs to the workflow method are stored in scope automatically (using param names as keys)
2. Each agent reads what it needs from scope (by matching its method parameter names to scope keys)
3. Each agent writes its result back to scope using its `outputKey`
4. An `@Output` method at the end extracts values from scope to build the final result

```
Workflow Inputs → Scope → Agent 1 reads + writes → Agent 2 reads + writes → @Output extracts
```

**Example flow:**
```
Workflow called with: (userId, topic, feedback)
    ↓
Scope: { userId, topic, feedback }
    ↓
EvaluatorAgent runs, writes: { score: 0.72, weakAreas: ["vocabulary"] }
    ↓
Scope: { userId, topic, feedback, score, weakAreas }
    ↓
AdapterAgent runs, reads score + weakAreas, writes: { updatedPlan: {...} }
    ↓
@Output extracts { score, weakAreas, updatedPlan } → returns SessionResult
```

**Critical:** Parameter names must match `outputKey` values exactly. This is how scope values flow between agents.

---

## The Supervisor Pattern

### What it is
A **supervisor agent** is an LLM-powered agent that:
- Autonomously coordinates other sub-agents
- Makes runtime decisions about which agents to invoke (no hardcoded `if/else`)
- Adapts its orchestration based on context, business rules, and current conditions

### Supervisor vs Conditional Workflow

| Aspect | Conditional Workflow | Supervisor Agent |
|---|---|---|
| Decision logic | Hardcoded boolean checks | AI-driven reasoning |
| Flexibility | Fixed rules in code | Adapts to context |
| Maintenance | Update code to change routing | Update system prompt |
| Use when | Simple, predictable branching | Complex, context-dependent orchestration |

### When to use a Supervisor
- Routing depends on multiple factors that are hard to encode as booleans
- Business rules need to change without code deploys
- Complex agent interdependencies (e.g., call PricingAgent only if DispositionFeedback says "severe damage")

### Supervisor Request Pattern
The supervisor needs a **carefully engineered user message** (the `@SupervisorRequest`) that:
- States clearly what the supervisor's job is
- Describes what feedback has already been analyzed (as named variables)
- Provides step-by-step instructions for the complex path
- Explicitly tells the supervisor what NOT to do in the simple path (prevents unnecessary agent calls)

```python
# Python equivalent of @SupervisorRequest
def build_supervisor_request(context: dict) -> str:
    if context["disposition_required"]:
        return f"""
        DISPOSITION REQUIRED — follow this workflow:
        STEP 1: Invoke PricingAgent to get car value
        STEP 2: Invoke DispositionAgent (SCRAP/SELL/DONATE/KEEP)
        STEP 3: If KEEP → invoke MaintenanceAgent if needed, CleaningAgent if needed

        Car: {context['year']} {context['make']} #{context['car_number']}
        Feedback: {context['feedback']}
        """
    else:
        return f"""
        NO DISPOSITION REQUIRED.
        DO NOT invoke PricingAgent.
        DO NOT invoke DispositionAgent.
        Only invoke MaintenanceAgent if maintenance needed.
        Only invoke CleaningAgent if cleaning needed.

        Car: {context['year']} {context['make']} #{context['car_number']}
        Cleaning request: {context['cleaning_request']}
        Maintenance request: {context['maintenance_request']}
        """
```

**Key insight:** Being explicit about what NOT to do prevents the LLM from making unnecessary tool calls.

---

## Human-in-the-Loop (HITL)

For high-stakes decisions, insert a human review step between the AI's proposal and execution:

```
Agent Analysis → Proposal Agent → Human Review → Conditional Execution
                                               └→ Fallback (if rejected)
```

**AllTeacher relevance:** Could apply to curriculum plan changes when the Adapter wants to significantly restructure the plan — surface the proposed change to the user before committing.

**Pattern:**
1. `PlannerAgent` generates a new plan proposal
2. System sends proposal to user: "Based on your progress, I'd like to adjust Week 3. Here's what I'm proposing…"
3. User approves or rejects
4. If approved → commit to DB; if rejected → keep current plan or ask for guidance

---

## Agent Design Principles

### 1. One agent = one specialized job
Avoid "god agents" that try to do everything. Each agent should be excellent at a single task:
- `Assessor` — only evaluates user level/style
- `Planner` — only builds curriculum structure
- `ContentFetcher` — only finds resources
- `ExerciseWriter` — only generates exercises
- etc.

### 2. Tools enable side effects
Agents reason; tools act. A tool:
- Updates the database
- Calls an external API
- Writes a file
- Sends a notification

The agent decides WHEN to call the tool; the tool does the actual work.

### 3. Clear system messages are critical
The `@SystemMessage` (system prompt) must specify:
- **WHO** the agent is
- **WHAT** it does
- **WHEN** to use tools (and when NOT to)
- **HOW** to respond (output format, keywords)

Weak system prompt → unpredictable agent behavior.

### 4. `outputKey` enables data sharing without coupling
Agents don't call each other directly. They write to scope. The next agent reads from scope by param name. This keeps agents loosely coupled and independently testable.

### 5. Use `@Output` / extraction to combine results
The final step in a workflow is a deterministic function (not an LLM call) that extracts specific keys from scope and assembles the return value. This keeps business logic explicit.

---

## Mapping to AllTeacher's Pipeline

### Current pipeline (sequential, all in orchestrator)
```
User message
  → Assessor
  → Planner
  → ContentFetcher
  → ExerciseWriter
  → Evaluator
  → Tracker
  → Adapter (Pro+)
  → Motivator (optional)
  → Response streamed to app
```

### Recommended redesign using workshop patterns

#### Phase 1: Parallel Feedback Analysis
Run independent feedback agents simultaneously after a user submission:

```
User submission
  ↓
[PARALLEL]
  ├── EvaluatorAgent     → outputKey: "evaluation"     (scores answer, flags weak areas)
  ├── TrackerAgent       → outputKey: "progressUpdate" (updates streak, mastery scores)
  └── MotivatorAgent     → outputKey: "encouragement"  (contextual message, optional)
```

#### Phase 2: Conditional Adaptation
After parallel feedback, conditionally run the Adapter:

```
[CONDITIONAL]
  ├── IF mastery_score < threshold → AdapterAgent → outputKey: "planUpdate"
  └── ELSE skip
```

#### Phase 3: Content Generation
Then generate the next exercise/content:

```
[SEQUENTIAL]
  ├── ContentFetcherAgent (if new module starting)
  └── ExerciseWriterAgent → outputKey: "nextExercise"
```

#### Full workflow interface (Python pseudocode)
```python
class SessionWorkflow:
    """
    Sequential top-level workflow:
    1. FeedbackWorkflow (parallel: Evaluator + Tracker + Motivator)
    2. AdaptationWorkflow (conditional: Adapter if weak areas detected)
    3. ContentWorkflow (sequential: Fetcher → ExerciseWriter)
    """

    def process_session(
        self,
        user_id: str,
        curriculum_id: str,
        week_id: str,
        module_topic: str,
        user_submission: str,
        conversation_history: list,
        native_language: str,
        target_language: str,
        current_mastery: float,
        seen_exercise_ids: list[str],
    ) -> SessionResult:
        ...

    @staticmethod
    def output(
        evaluation: dict,
        progress_update: dict,
        encouragement: str,
        plan_update: dict | None,
        next_exercise: dict,
    ) -> SessionResult:
        return SessionResult(
            evaluation=evaluation,
            progress=progress_update,
            encouragement=encouragement,
            plan_changed=plan_update is not None,
            next_exercise=next_exercise,
        )
```

---

## Supervisor for AllTeacher (Advanced)

For Power-tier users with complex curriculum paths, a `CurriculumSupervisorAgent` could:
- Dynamically decide whether to re-plan, fetch new content, or just continue
- Route high-performing students to advanced modules automatically
- Route struggling students to remediation exercises
- Suggest a curriculum domain switch if the student shows signs of disengagement

```python
supervisor_request_template = """
You are a curriculum supervisor for AllTeacher.

Student: {user_id}
Current topic: {module_topic}
Mastery score this week: {mastery_score}
Weak areas: {weak_areas}
Sessions this week: {session_count}
Streak: {streak_days} days

Feedback analysis:
- Evaluation: {evaluation_summary}
- Progress: {progress_summary}

DECISION RULES:
- If mastery_score >= 0.85 for all subtopics → advance to next module
- If mastery_score < 0.4 for >= 2 subtopics → invoke AdapterAgent to re-plan
- If session_count >= 3 and mastery_score < 0.5 → invoke MotivatorAgent (special encouragement)
- Otherwise → only invoke ExerciseWriterAgent for next exercise

Available agents: AdapterAgent, ExerciseWriterAgent, MotivatorAgent, ContentFetcherAgent
"""
```

---

## Practical Implementation Notes (Python / Flask / OpenAI)

### AgenticScope equivalent
Use a plain dict as shared state, passed by reference through the pipeline:

```python
scope = {
    # inputs (set before workflow runs)
    "user_id": user_id,
    "submission": submission,
    "mastery_scores": mastery_scores,
    # outputs (set by agents as they run)
    "evaluation": None,
    "plan_update": None,
    "next_exercise": None,
}
```

### Sequential execution
```python
async def run_sequential(*agents, scope: dict):
    for agent_fn in agents:
        result = await agent_fn(scope)
        scope.update(result)
    return scope
```

### Parallel execution
```python
import asyncio

async def run_parallel(*agents, scope: dict):
    results = await asyncio.gather(*[agent_fn(scope) for agent_fn in agents])
    for result in results:
        scope.update(result)
    return scope
```

### Conditional execution
```python
async def run_conditional(condition_fn, agent_fn, scope: dict):
    if condition_fn(scope):
        result = await agent_fn(scope)
        scope.update(result)
    return scope
```

### Supervisor (OpenAI function-calling based)
The supervisor receives the scope state + a list of available sub-agents (as OpenAI tools), then makes function calls to invoke them. The orchestrator processes those function calls by actually running the referenced agents.

```python
async def run_supervisor(supervisor_prompt: str, sub_agents: dict, scope: dict):
    """
    supervisor_prompt: built from scope values (the @SupervisorRequest equivalent)
    sub_agents: {"AdapterAgent": adapter_fn, "ExerciseWriter": exercise_fn, ...}
    """
    tools = [agent_as_tool(name, fn) for name, fn in sub_agents.items()]

    messages = [
        {"role": "system", "content": SUPERVISOR_SYSTEM_PROMPT},
        {"role": "user", "content": supervisor_prompt},
    ]

    while True:
        response = await openai_client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            tools=tools,
        )
        choice = response.choices[0]

        if choice.finish_reason == "stop":
            scope["supervisor_decision"] = choice.message.content
            break

        # Process tool calls → run the corresponding sub-agent
        for tool_call in choice.message.tool_calls:
            agent_name = tool_call.function.name
            args = json.loads(tool_call.function.arguments)
            result = await sub_agents[agent_name]({**scope, **args})
            scope.update(result)
            messages.append({"role": "tool", "content": json.dumps(result), "tool_call_id": tool_call.id})

    return scope
```

---

## Best Practices Summary

1. **Specialize agents** — one job per agent, never a god-agent
2. **Parallel where independent** — EvaluatorAgent and TrackerAgent can always run in parallel
3. **Conditional before expensive** — check mastery thresholds before calling AdapterAgent
4. **Explicit supervisor requests** — say what to do AND what not to do
5. **outputKey discipline** — use consistent, descriptive names; document them
6. **Test agents in isolation** — each agent should be callable independently with a mock scope
7. **Cap loops** — always set a max_iterations on loop agents
8. **HITL for high-stakes** — surface plan restructures to the user before committing
9. **Prompts define behavior** — changing a system prompt changes the agent; clear > clever
10. **Scope is the API** — treat scope keys as a typed contract between agents

---

## Key Patterns Quick Reference

| Pattern | Annotation | Python equivalent | AllTeacher use |
|---|---|---|---|
| Single agent + tool | `@Agent` + `@ToolBox` | Agent function + tool dict | Each individual agent |
| Sequential | `@SequenceAgent` | `run_sequential(a, b, c, scope)` | Assessor → Planner → ContentFetcher |
| Parallel | `@ParallelAgent` | `asyncio.gather(...)` | Evaluator ∥ Tracker ∥ Motivator |
| Conditional | `@ConditionalAgent` | `if condition(scope): run(agent)` | Adapter only when needed |
| Loop | `@LoopAgent` | `while not done(scope): run(agent)` | ExerciseWriter fill-to-N |
| Supervisor | `@SupervisorAgent` | OpenAI tool-calling loop | Power tier dynamic routing |
| HITL | Proposal + human gate | Flask endpoint + user response | Plan change approval |
| Nested | Workflow inside workflow | Compose any of the above | Full session pipeline |

---

## Sources
- https://quarkus.io/quarkus-workshop-langchain4j/section-2/step-01/ — Implementing AI Agents
- https://quarkus.io/quarkus-workshop-langchain4j/section-2/step-02/ — Simple Agentic Workflows
- https://quarkus.io/quarkus-workshop-langchain4j/section-2/step-03/ — Composing Multiple Workflows
- https://quarkus.io/quarkus-workshop-langchain4j/section-2/step-04/ — Supervisor Pattern
- https://quarkus.io/quarkus-workshop-langchain4j/section-2/conclusion/ — Mastering Agentic Systems
