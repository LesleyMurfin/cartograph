<div align="center">
  <br />
    <a href="" target="_blank">
      <img src="public/readme/readme-hero.webp" alt="Project Banner">
    </a>
  <br />

  <div>
    <img src="https://img.shields.io/badge/-Next.js_-black?style=for-the-badge&logo=nextdotjs&logoColor=white" />
    <img src="https://img.shields.io/badge/-TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" />
    <img src="https://img.shields.io/badge/-Tailwind-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white" />
    <br />
    <img src="https://img.shields.io/badge/-Clerk-6C47FF?style=for-the-badge&logo=clerk&logoColor=white" />
    <img src="https://img.shields.io/badge/-Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white" />
    <img src="https://img.shields.io/badge/-LangSmith-1C1C1C?style=for-the-badge&logo=langchain&logoColor=white" />
    <img src="https://img.shields.io/badge/-CodeRabbit-FF6600?style=for-the-badge&logo=coderabbit&logoColor=white" />
  </div>

  <h3 align="center">Cartograph | AI-Powered Codebase Dependency Mapper</h3>

  <div align="center">
    Build this project step by step with our detailed tutorial on <a href="https://www.youtube.com/watch?v=XUkNR-JfHwo" target="_blank"><b>JavaScript Mastery</b></a> YouTube. Join the JSM family!
  </div>
</div>

## 📋 <a name="table">Table of Contents</a>

1. ✨ [Introduction](#introduction)
2. ⚙️ [Tech Stack](#tech-stack)
3. 🔋 [Features](#features)
4. 🤸 [Quick Start](#quick-start)
5. 🔗 [Assets](#links)
6. 🚀 [More](#more)

## 🚨 Tutorial

This repository contains the code corresponding to an in-depth tutorial available on our YouTube channel, <a href="https://www.youtube.com/@javascriptmastery/videos" target="_blank"><b>JavaScript Mastery</b></a>.

If you prefer visual learning, this is the perfect resource for you. Follow our tutorial to learn how to build projects like these step-by-step in a beginner-friendly manner!

<a href="" target="_blank"><img src="https://github.com/sujatagunale/EasyRead/assets/151519281/1736fca5-a031-4854-8c09-bc110e3bc16d" /></a>

## <a name="introduction">✨ Introduction</a>

Cartograph is a developer tool that turns any public TypeScript or JavaScript repository into an interactive dependency map. Modern engineering teams frequently ship AI-generated code without fully reading every underlying file, creating complex architectural webs with hidden imports and coupled modules. Cartograph solves this by parsing raw source code into navigable nodes and edges, allowing developers to immediately visualize dependency chains, evaluate blast radii before making edits, and ask AI models for context-aware explanations grounded entirely in true AST parsing.

Built around a strict core principle, Cartograph guarantees that every node and edge on the canvas comes directly from real code analysis rather than AI predictions. By keeping graph arithmetic pure and standalone, the AI agent is only permitted to explain and summarize verified structure. Packed with multi-tenant organization support via Clerk, row-level security on Supabase, and full observability tracing through LangSmith, Cartograph provides production-grade infrastructure for software teams navigating large codebases.

If you're getting started and need assistance or face any bugs, join our active Discord community with over **50k+** members. It's a place where people help each other out.

<a href="https://discord.com/invite/n6EdbFJ" target="_blank"><img src="https://github.com/sujatagunale/EasyRead/assets/151519281/618f4872-1e10-42da-8213-1d69e486d02e" /></a>

## <a name="tech-stack">⚙️ Tech Stack</a>

- **[Next.js 16](https://nextjs.org/)** is a full-stack React framework that powers Cartograph using the App Router, Server Actions, and dynamic server-rendering capabilities for seamless frontend-backend integration.

- **[TypeScript 5](https://www.typescriptlang.org/)** is a strongly typed superset of JavaScript that ensures strict type safety across the entire application and parser pipeline.

- **[ts-morph](https://ts-morph.com/)** is a wrapper around the TypeScript Compiler API that parses source code files, imports, re-exports, and dynamic references into deterministic AST graph structures.

- **[React Flow (@xyflow/react)](https://reactflow.dev/)** is an interactive canvas library used alongside dagre for laying out, rendering, and navigating complex codebase dependency graphs.

- **[Clerk](https://jsm.dev/carto-clerk)** provides identity management and multi-tenant organization authorization, issuing tokens that govern user access throughout the platform.

- **[Supabase](https://jsm.dev/carto-supabase)** supplies the Postgres database layer with strict Row-Level Security (RLS) policies enforced directly via JWT claims.

- **[OpenAI SDK](https://platform.openai.com/)** drives the AI explanation and agentic inspection capabilities, providing answers grounded strictly in parsed code structures.

- **[LangSmith](https://jsm.dev/carto-langsmith)** is an observability platform that traces every LLM call, records dataset runs, and evaluates model responses against exact ground-truth code metrics.

- **[Tailwind CSS v4](https://tailwindcss.com/)** is a utility-first CSS framework that powers Cartograph's dense, high-information developer interface.

- **[CodeRabbit](https://jsm.dev/carto-coderabbit)** is an AI code reviewer that automatically analyzes PRs to enforce architectural rules and codebase consistency.

## <a name="features">🔋 Features</a>

👉 **AST Codebase Parsing**: Converts public GitHub repositories into complete node-and-edge graph maps by parsing imports, re-exports, dynamic imports, and `require()` calls without relying on AI predictions.

👉 **Interactive Canvas Mapping**: Zoom, expand folders into individual files, select modules, and view connected incoming and outgoing dependencies rendered via React Flow.

👉 **Blast Radius Calculation**: Instant arithmetic over the graph structure to reveal exactly which files and downstream modules break if a specific file is changed.

👉 **Grounded Module Explanations**: Contextual summaries generated for any file using only its real AST connections, with every mentioned filename hyperlinked directly on the map.

👉 **Agentic Repository Chat**: Interactive agent panel that walks verified graph paths step-by-step to answer architectural questions without inventing non-existent files or relationships.

👉 **Multi-Tenant Organizations**: Shared codebase analyses linked to Clerk organizations so team members collaborate from a single unified map.

👉 **Row-Level Postgres Security**: Automatic data isolation across teams using Supabase Postgres policies evaluated directly against Clerk JWT claims.

👉 **LangSmith Trace & Evaluation**: Full tracing of every AI execution call, cache hit verification, and benchmark evaluation against true repository file lists.

And many more, including code architecture and reusability.

## <a name="quick-start">🤸 Quick Start</a>

Follow these steps to set up the project locally on your machine.

**Prerequisites**

Make sure you have the following installed on your machine:

- [Git](https://git-scm.com/)
- [Node.js](https://nodejs.org/en)
- [pnpm](https://pnpm.io/) (Package Manager)

**Cloning the Repository**

```bash
git clone https://github.com/adrianhajdin/cartograph.git
cd cartograph
```

**Installation**

Install the project dependencies using pnpm:

```bash
pnpm install
```

**Set Up Environment Variables**

Create a new file named `.env.local` in the root of your project and add the following content:

```env
# CLERK
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL=/
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

# SUPABASE
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=
SUPABASE_SECRET_KEY=

# LANGSMITH
LANGSMITH_TRACING=true
LANGSMITH_API_KEY=
LANGSMITH_PROJECT=cartograph
LANGSMITH_ENDPOINT=https://api.smith.langchain.com

# OPENAI
OPENAI_API_KEY=

# Agent Service (deep-agent/, `pnpm dev` there).
AGENT_URL=http://localhost:2024
```

Replace the placeholder values with your real credentials. You can get these by signing up at: [**Clerk**](https://clerk.com/), [**Supabase**](https://supabase.com/), [**OpenAI**](https://platform.openai.com/), and [**LangSmith**](https://smith.langchain.com/).

**Running the Project**

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser to view the project.

## <a name="links">🔗 Assets</a>

Assets and snippets used in the project can be found in the **[video kit](https://jsm.dev/carto-kit)**.

<a href="https://jsm.dev/carto-kit" target="_blank">
  <img src="public/readme/readme-videokit.webp" alt="Video Kit Banner">
</a>

## <a name="more">🚀 More</a>

**Advance your skills with our Pro Course**

Enjoyed creating this project? Dive deeper into our PRO courses for a richer learning adventure. They're packed with
detailed explanations, cool features, and exercises to boost your skills. Give it a go!

<a href="https://jsm.dev/ai" target="_blank">
  <img src="public/readme/readme-jsmpro.webp" alt="Project Banner">
</a>