# 🧪 Fullstack Assessment

**Theme: Court Reporting Workflow System**

---

## Overview

```yaml
Title: Court Reporting Workflow Manager

Goal: Build a simplified workflow system for managing transcription jobs
```

---

## Core Scenario

```yaml
A court reporting agency receives audio recordings.

They need to:
1. Assign jobs to court reporters
2. Assign editors to review transcripts
3. Track job status
4. Calculate payments
```

---

## Required Features

### 1. Job Management

```yaml
Create a job:
- case_name
- duration (minutes)
- location (physical / remote)
- status
```

Statuses:

```yaml
NEW → ASSIGNED → TRANSCRIBED → REVIEWED → COMPLETED
```

---

### 2. Reporter Assignment

* Assign job to a reporter
* Reporter attributes:

  * name
  * location
  * availability

Logic:

* Prefer same city for physical jobs
* Allow remote assignment

---

### 3. Editor Assignment

* Assign editor after transcription
* Track review status

---

### 4. Payment Calculation

```yaml
Example rules:
- Reporter paid per minute (e.g. 2000 IDR/min)
- Editor paid per job (flat fee)

System should:
- calculate total payout
- display per-job earnings
```

---

## Frontend Requirements

* Simple dashboard:

  * job list
  * status
  * assignments

* Basic UI is fine (function > design)

---

## Backend Requirements

* REST API:

  * create job
  * assign reporter/editor
  * update status
  * calculate payment

* Use:

  * Node.js + TypeScript
  * any DB (Postgres preferred, SQLite OK)
