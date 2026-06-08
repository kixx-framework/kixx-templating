# Mustache Conformance Report

Spec commit: `e8ec001db7f594521e773c34866aca2b5d6b0037`
Generated: 2026-06-08T15:24:19.521Z
Engine: current Kixx (through Phase 6 helper extension hardening)

**Core compliance: 128 / 136 (94.1%)**

Optional spec files are tracked for visibility only. `~lambdas`, `~dynamic-names`, and `~inheritance` are intentionally unsupported.

## Per-file results

| File | Tier | Pass | Fail | Threw | Total | Pass % |
|------|------|------|------|-------|-------|--------|
| interpolation | core | 37 | 5 | 0 | 42 | 88.1 |
| sections | core | 31 | 3 | 0 | 34 | 91.2 |
| inverted | core | 22 | 0 | 0 | 22 | 100.0 |
| comments | core | 12 | 0 | 0 | 12 | 100.0 |
| partials | core | 12 | 0 | 0 | 12 | 100.0 |
| delimiters | core | 14 | 0 | 0 | 14 | 100.0 |
| ~lambdas | optional | 1 | 9 | 0 | 10 | 10.0 |
| ~dynamic-names | optional | 5 | 16 | 0 | 21 | 23.8 |
| ~inheritance | optional | 0 | 0 | 27 | 27 | 0.0 |

## Failure causes

| Cause | Count |
|-------|-------|
| inheritance | 27 |
| dynamic-names | 16 |
| lambdas | 9 |
| object-section-iteration | 8 |

## Detail


### interpolation

- ✅ No Interpolation
- ✅ Basic Interpolation
- ✅ No Re-interpolation
- ✅ HTML Escaping
- ✅ Triple Mustache
- ✅ Ampersand
- ✅ Basic Integer Interpolation
- ✅ Triple Mustache Integer Interpolation
- ✅ Ampersand Integer Interpolation
- ✅ Basic Decimal Interpolation
- ✅ Triple Mustache Decimal Interpolation
- ✅ Ampersand Decimal Interpolation
- ✅ Basic Null Interpolation
- ✅ Triple Mustache Null Interpolation
- ✅ Ampersand Null Interpolation
- ✅ Basic Context Miss Interpolation
- ✅ Triple Mustache Context Miss Interpolation
- ✅ Ampersand Context Miss Interpolation
- ❌ Dotted Names - Basic Interpolation _(object-section-iteration)_
- ❌ Dotted Names - Triple Mustache Interpolation _(object-section-iteration)_
- ❌ Dotted Names - Ampersand Interpolation _(object-section-iteration)_
- ✅ Dotted Names - Arbitrary Depth
- ✅ Dotted Names - Broken Chains
- ✅ Dotted Names - Broken Chain Resolution
- ❌ Dotted Names - Initial Resolution _(object-section-iteration)_
- ❌ Dotted Names - Context Precedence _(object-section-iteration)_
- ✅ Dotted Names are never single keys
- ✅ Dotted Names - No Masking
- ✅ Implicit Iterators - Basic Interpolation
- ✅ Implicit Iterators - HTML Escaping
- ✅ Implicit Iterators - Triple Mustache
- ✅ Implicit Iterators - Ampersand
- ✅ Implicit Iterators - Basic Integer Interpolation
- ✅ Interpolation - Surrounding Whitespace
- ✅ Triple Mustache - Surrounding Whitespace
- ✅ Ampersand - Surrounding Whitespace
- ✅ Interpolation - Standalone
- ✅ Triple Mustache - Standalone
- ✅ Ampersand - Standalone
- ✅ Interpolation With Padding
- ✅ Triple Mustache With Padding
- ✅ Ampersand With Padding

### sections

- ✅ Truthy
- ✅ Falsey
- ✅ Null is falsey
- ❌ Context _(object-section-iteration)_
- ❌ Parent contexts _(object-section-iteration)_
- ✅ Variable test
- ✅ List Contexts
- ❌ Deeply Nested Contexts _(object-section-iteration)_
- ✅ List
- ✅ Empty List
- ✅ Doubled
- ✅ Nested (Truthy)
- ✅ Nested (Falsey)
- ✅ Context Misses
- ✅ Implicit Iterator - String
- ✅ Implicit Iterator - Integer
- ✅ Implicit Iterator - Decimal
- ✅ Implicit Iterator - Array
- ✅ Implicit Iterator - HTML Escaping
- ✅ Implicit Iterator - Triple mustache
- ✅ Implicit Iterator - Ampersand
- ✅ Implicit Iterator - Root-level
- ✅ Dotted Names - Truthy
- ✅ Dotted Names - Falsey
- ✅ Dotted Names - Broken Chains
- ✅ Surrounding Whitespace
- ✅ Internal Whitespace
- ✅ Indented Inline Sections
- ✅ Standalone Lines
- ✅ Indented Standalone Lines
- ✅ Standalone Line Endings
- ✅ Standalone Without Previous Line
- ✅ Standalone Without Newline
- ✅ Padding

### inverted

- ✅ Falsey
- ✅ Truthy
- ✅ Null is falsey
- ✅ Context
- ✅ List
- ✅ Empty List
- ✅ Doubled
- ✅ Nested (Falsey)
- ✅ Nested (Truthy)
- ✅ Context Misses
- ✅ Dotted Names - Truthy
- ✅ Dotted Names - Falsey
- ✅ Dotted Names - Broken Chains
- ✅ Surrounding Whitespace
- ✅ Internal Whitespace
- ✅ Indented Inline Sections
- ✅ Standalone Lines
- ✅ Standalone Indented Lines
- ✅ Standalone Line Endings
- ✅ Standalone Without Previous Line
- ✅ Standalone Without Newline
- ✅ Padding

### comments

- ✅ Inline
- ✅ Multiline
- ✅ Standalone
- ✅ Indented Standalone
- ✅ Standalone Line Endings
- ✅ Standalone Without Previous Line
- ✅ Standalone Without Newline
- ✅ Multiline Standalone
- ✅ Indented Multiline Standalone
- ✅ Indented Inline
- ✅ Surrounding Whitespace
- ✅ Variable Name Collision

### partials

- ✅ Basic Behavior
- ✅ Failed Lookup
- ✅ Context
- ✅ Recursion
- ✅ Nested
- ✅ Surrounding Whitespace
- ✅ Inline Indentation
- ✅ Standalone Line Endings
- ✅ Standalone Without Previous Line
- ✅ Standalone Without Newline
- ✅ Standalone Indentation
- ✅ Padding Whitespace

### delimiters

- ✅ Pair Behavior
- ✅ Special Characters
- ✅ Sections
- ✅ Inverted Sections
- ✅ Partial Inheritence
- ✅ Post-Partial Behavior
- ✅ Surrounding Whitespace
- ✅ Outlying Whitespace (Inline)
- ✅ Standalone Tag
- ✅ Indented Standalone Tag
- ✅ Standalone Line Endings
- ✅ Standalone Without Previous Line
- ✅ Standalone Without Newline
- ✅ Pair with Padding

### ~lambdas (optional)

- ❌ Interpolation _(lambdas)_
- ❌ Interpolation - Expansion _(lambdas)_
- ❌ Interpolation - Alternate Delimiters _(lambdas)_
- ❌ Interpolation - Multiple Calls _(lambdas)_
- ❌ Escaping _(lambdas)_
- ❌ Section _(lambdas)_
- ❌ Section - Expansion _(lambdas)_
- ❌ Section - Alternate Delimiters _(lambdas)_
- ❌ Section - Multiple Calls _(lambdas)_
- ✅ Inverted Section

### ~dynamic-names (optional)

- ❌ Basic Behavior - Partial _(dynamic-names)_
- ❌ Basic Behavior - Name Resolution _(dynamic-names)_
- ✅ Context Misses - Partial
- ✅ Failed Lookup - Partial
- ❌ Context _(dynamic-names)_
- ❌ Dotted Names _(dynamic-names)_
- ✅ Dotted Names - Operator Precedence
- ❌ Dotted Names - Failed Lookup _(dynamic-names)_
- ❌ Dotted names - Context Stacking _(dynamic-names)_
- ❌ Dotted names - Context Stacking Under Repetition _(dynamic-names)_
- ❌ Dotted names - Context Stacking Failed Lookup _(dynamic-names)_
- ❌ Recursion _(dynamic-names)_
- ✅ Dynamic Names - Double Dereferencing
- ✅ Dynamic Names - Composed Dereferencing
- ❌ Surrounding Whitespace _(dynamic-names)_
- ❌ Inline Indentation _(dynamic-names)_
- ❌ Standalone Line Endings _(dynamic-names)_
- ❌ Standalone Without Previous Line _(dynamic-names)_
- ❌ Standalone Without Newline _(dynamic-names)_
- ❌ Standalone Indentation _(dynamic-names)_
- ❌ Padding Whitespace _(dynamic-names)_

### ~inheritance (optional)

- 💥 Default _(inheritance)_
- 💥 Variable _(inheritance)_
- 💥 Triple Mustache _(inheritance)_
- 💥 Sections _(inheritance)_
- 💥 Negative Sections _(inheritance)_
- 💥 Mustache Injection _(inheritance)_
- 💥 Inherit _(inheritance)_
- 💥 Overridden content _(inheritance)_
- 💥 Data does not override block _(inheritance)_
- 💥 Data does not override block default _(inheritance)_
- 💥 Overridden parent _(inheritance)_
- 💥 Two overridden parents _(inheritance)_
- 💥 Override parent with newlines _(inheritance)_
- 💥 Inherit indentation _(inheritance)_
- 💥 Only one override _(inheritance)_
- 💥 Parent template _(inheritance)_
- 💥 Recursion _(inheritance)_
- 💥 Multi-level inheritance _(inheritance)_
- 💥 Multi-level inheritance, no sub child _(inheritance)_
- 💥 Text inside parent _(inheritance)_
- 💥 Text inside parent _(inheritance)_
- 💥 Block scope _(inheritance)_
- 💥 Standalone parent _(inheritance)_
- 💥 Standalone block _(inheritance)_
- 💥 Block reindentation _(inheritance)_
- 💥 Intrinsic indentation _(inheritance)_
- 💥 Nested block reindentation _(inheritance)_
