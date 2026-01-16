# Sync IXL Recommendations

This skill uses Claude Code's Chrome integration to extract IXL recommendations for each child and sync them to the weekly planner.

## Prerequisites

- Chrome browser open with IXL logged in (parent account with access to all children)
- Claude Code connected to Chrome (`claude --chrome` or `/chrome`)
- The homeschool app running locally with Convex

## Usage

Ask Claude Code: "Sync IXL recommendations for my children"

Or for a specific child: "Sync IXL recommendations for Lucas"

## Children in This Family

Based on the app data:
- **Lucas** (Age 13) - ages14to16
- **Sansa** (Age 10) - ages10to13
- **Kirse** (Age 6) - ages6to9

## Workflow

### Step 1: Check Chrome Connection

Ensure Chrome is connected. If not, ask the user to:
1. Open Chrome with IXL logged in
2. Run `/chrome` to connect

### Step 2: Navigate to Each Child's Recommendations

For each child, IXL has separate profiles. Navigate to:

**Math Diagnostic Arena:**
```
https://www.ixl.com/diagnostic/arena?subject=math
```

**Language Arts Diagnostic Arena:**
```
https://www.ixl.com/diagnostic/arena?subject=ela
```

### Step 3: Extract Data from IXL Page

On the IXL recommendations page, look for these elements:

1. **Current Diagnostic Level** - Usually displayed as a number (0-1300 scale) or grade equivalent
2. **Recommended Skills** - Listed as clickable items, usually showing:
   - Skill code (e.g., "L.1", "G.3")
   - Skill name
   - Strand/category
3. **Strand Breakdown** - Shows level per strand (Algebra, Geometry, etc.)

### Step 4: Save to Convex Database

Use the Convex mutations to save the extracted data:

**Save Diagnostic Data:**
```typescript
// Call via Convex: api.ixlData.saveDiagnostic
{
  childId: "<child_id>",
  subject: "math",
  overallLevel: 850,
  strands: [
    { name: "Algebra", level: 720, gradeEquivalent: "6th grade" },
    { name: "Geometry", level: 850, gradeEquivalent: "7th grade" },
  ]
}
```

**Save Recommendations:**
```typescript
// Call via Convex: api.ixlData.saveRecommendations
{
  childId: "<child_id>",
  subject: "math",
  recommendations: [
    { skillId: "L.1", skillName: "Solve linear equations", strand: "Algebra", priority: 1 },
    { skillId: "G.3", skillName: "Area of triangles", strand: "Geometry", priority: 2 },
  ]
}
```

### Step 5: Apply to Schedule

Once recommendations are saved, apply them to the weekly schedule:

```typescript
// Call via Convex: api.ixlData.applyRecommendationsToSchedule
{
  childId: "<child_id>",
  subject: "math",
  dayOfWeek: 1  // Monday
}
```

This updates the schedule blocks with specific skill recommendations.

### Step 6: Report Results

```markdown
## IXL Sync Complete

### Lucas (Age 13)
- **Math**: 5 recommendations extracted
  - Diagnostic Level: 850/1300
  - Focus: Algebra (3), Geometry (2)
  - Top skill: "Solve linear equations"
- **Language Arts**: 4 recommendations extracted
  - Diagnostic Level: 720/1300
  - Focus: Reading Comprehension (2), Writing (2)

### Sansa (Age 10)
...

### Schedule Updated
All children's weekly schedules have been updated with IXL recommendations.
```

## IXL Page Structure Tips

### Switching Between Children
IXL parent accounts have a child switcher. Look for:
- A profile icon/dropdown in the top navigation
- "Switch student" or similar option
- Child names listed in a menu

### Finding Diagnostic Levels
The diagnostic arena page shows:
- Overall level in a prominent display
- Strand breakdown in expandable sections
- Grade-level equivalents

### Finding Recommendations
Look for sections labeled:
- "Recommended for you"
- "Skills to work on"
- "Diagnostic recommendations"
- Usually highlighted with a star or priority indicator

## API Reference

The app has these Convex endpoints for IXL data:

| Endpoint | Description |
|----------|-------------|
| `api.ixlData.saveDiagnostic` | Save diagnostic levels |
| `api.ixlData.saveRecommendations` | Save skill recommendations |
| `api.ixlData.getDiagnostics` | Get latest diagnostics |
| `api.ixlData.getRecommendations` | Get current recommendations |
| `api.ixlData.applyRecommendationsToSchedule` | Update schedule with recommendations |
| `api.ixlData.getAllChildrenIxlStatus` | Dashboard view of all children |

## Error Handling

- **Login required**: If IXL shows a login page, pause and ask the user to log in manually
- **Child not found**: If a child profile isn't in IXL, skip and report
- **Page structure changed**: If expected elements aren't found, report what's visible and ask for guidance
- **Rate limiting**: Wait 2-3 seconds between page navigations

## Convex Child IDs

To save data, you'll need the Convex child IDs. Query them from the app:
```typescript
// Query: api.childProfiles.list
// Returns all children with their _id, name, and ageGroup
```
