# Regex Pattern Strategy

## Overview

All semantic clusters now use **RegExp patterns** instead of strings for consistent, accurate matching with proper word boundaries and pattern variations.

## Word Boundary Strategy

### ✅ Use `\b` (Word Boundaries) For:

**1. Action Verbs** - Match exact verb forms, not noun/adjective variations
```typescript
/\bmanage\b/i     // ✅ "manage teams"
                  // ❌ "management" (noun)
                  // ❌ "manager" (noun)

/\blead\b/i       // ✅ "lead projects"
                  // ❌ "leader" (noun)
                  // ❌ "leadership" (noun)
```

**2. Obligation Words** - Match exact modal verbs
```typescript
/\bmust\b/i       // ✅ "must have"
                  // ❌ "musty" (different word)

/\bshould\b/i     // ✅ "should be"
                  // ❌ "shoulder" (different word)
```

**3. Short Common Words** - Prevent false matches
```typescript
/\bteam\b/i       // ✅ "team player"
                  // ❌ "teammate" (we want this separately)
                  // ❌ "steam" (different word)

/\bclient/i       // ✅ "client", "clients"
                  // ✅ "client-facing" (hyphen is word boundary)
```

### ❌ Don't Use `\b` For:

**1. Multi-word Phrases** - Already specific enough
```typescript
/responsible for/i           // No \b needed
/attention to detail/i       // No \b needed
/the ideal candidate/i       // No \b needed
```

**2. Pattern Stems** - Match word variations
```typescript
/communicat/i     // ✅ "communicate"
                  // ✅ "communication"
                  // ✅ "communicating"
                  // ✅ "communicative"

/requirement/i    // ✅ "requirement"
                  // ✅ "requirements"

/abilit/i         // ✅ "ability"
                  // ✅ "abilities"

/proficien/i      // ✅ "proficiency"
                  // ✅ "proficient"
                  // ✅ "proficiencies"
```

**3. Words Where Variations Are Desired**
```typescript
/experience/i     // ✅ "experience"
                  // ✅ "experienced"
                  // ✅ "experiences"

/manager/i        // ✅ "manager"
                  // ✅ "managers"
                  // ✅ "managerial"

/stakeholder/i    // ✅ "stakeholder"
                  // ✅ "stakeholders"
```

## Pattern Categories

### 1. Universal Action Verbs
**Strategy**: Word boundaries on all verbs
```typescript
/\bmanage\b/i, /\blead\b/i, /\bsupport\b/i, /\bassist\b/i
```
**Why**: We want the verb form, not noun/adjective forms (manage vs management)

### 2. Responsibility Expressions
**Strategy**: No word boundaries (multi-word phrases)
```typescript
/responsible for/i, /in this role/i, /duties include/i
```
**Why**: Complete phrases are specific enough

### 3. Requirement Terminology
**Strategy**: Pattern stems without word boundaries
```typescript
/requirement/i, /qualification/i, /proficien/i, /competen/i
```
**Why**: Match singular/plural and variations (proficiency/proficient)

### 4. Candidate Phrases
**Strategy**: No word boundaries (multi-word phrases)
```typescript
/the ideal candidate/i, /we are looking for/i
```
**Why**: Complete phrases are specific enough

### 5. Skill Terminology
**Strategy**: Pattern stems, selective word boundaries
```typescript
/\bskill/i, /abilit/i, /competenc/i
```
**Why**: 
- `/\bskill/i` - matches "skill", "skills", "skilled" but not "unskilled"
- `/abilit/i` - matches "ability", "abilities"

### 6. Environment Terms
**Strategy**: Mixed approach
```typescript
/\bteam/i          // Word boundary (prevent "steam")
/collaborat/i      // Stem (collaboration, collaborative, collaborate)
/communicat/i      // Stem (communication, communicate, communicating)
```

### 7. Universal Soft Skills
**Strategy**: Pattern stems
```typescript
/communicat/i, /adaptab/i, /multitask/i
```
**Why**: Match all variations (adaptable, adaptability, adaptation)

### 8. Obligation Words
**Strategy**: Word boundaries on all
```typescript
/\bmust\b/i, /\bshould\b/i, /\brequired\b/i
```
**Why**: Exact modal verb matching

### 9. Operational Verbs
**Strategy**: Word boundaries on all verbs
```typescript
/\blift\b/i, /\bclean\b/i, /\bpack\b/i
```
**Why**: Match verb forms, not variations (lift vs lifter)

### 10. Structure Patterns
**Strategy**: No word boundaries (section headers)
```typescript
/responsibilities:/i, /requirements:/i, /skills:/i
```
**Why**: Matching section headers with colons

## Examples

### Good Matches
```typescript
// Action verbs with \b
"You will manage cross-functional teams"          // ✅ /\bmanage\b/
"Lead development of new features"                // ✅ /\blead\b/

// Pattern stems without \b
"Strong communication skills required"            // ✅ /communicat/
"Excellent ability to multitask"                  // ✅ /abilit/
"3+ years of experience"                          // ✅ /experience/

// Multi-word phrases
"The ideal candidate will have..."                // ✅ /the ideal candidate/
"You will be responsible for managing..."         // ✅ /responsible for/
```

### Prevented False Positives
```typescript
// Word boundaries prevent wrong matches
"Management experience required"                  // ❌ /\bmanage\b/ (correct!)
"Leadership skills"                               // ❌ /\blead\b/ (correct!)
"Steam cleaning equipment"                        // ❌ /\bteam\b/ (correct!)

// Stems allow desired variations
"Communicate with stakeholders"                   // ✅ /communicat/
"Communication skills"                            // ✅ /communicat/
"Communicating effectively"                       // ✅ /communicat/
```

## Testing Strategy

All patterns are case-insensitive (`/i` flag) and tested against:
- ✅ Positive cases (should match)
- ❌ Negative cases (should not match)
- 🔄 Variation cases (should match different forms)

## Performance

- **Regex compilation**: Patterns are compiled once at module load
- **Matching**: O(n) per pattern, efficient for short texts
- **Memory**: Minimal overhead (~100 RegExp objects)
