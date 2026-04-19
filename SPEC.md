# Spec

## Purpose
A simple accounting tool for my workflow. It should support German bookkeeping and accounting work by turning imported bank transactions into draft bookings and helping finalize them.

## Core workflow
1. Import CSV bank statements from the business account. Imports may overlap across statements, so the import process must deduplicate transactions.
2. Automatically create draft bookings from imported transactions.
3. Finalize each draft booking by adding the missing information, including receipt upload, receipt metadata extraction, AFA reference when required, accounting number, and other required booking data.

## Users
- Primary user: me
- Later: another person who uses the prepared information for the yearly tax process

## Later goals
- Use an LLM to help finalize draft bookings.
- Generate a report with the values needed for manual Vorsteueranmeldung entry in ELSTER.
