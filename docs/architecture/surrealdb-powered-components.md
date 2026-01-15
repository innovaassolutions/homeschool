# SurrealDB-Powered Components

## Authentication Service

**Responsibility:** Family account management, child profile creation, COPPA compliance

**SurrealDB Features Used:**
- Authentication scopes for parent/child access levels
- Document storage for family and profile data
- Real-time session management

**Key Authentication Queries:**

```sql
-- Create family account with COPPA compliance
CREATE families SET
    parent_name = $name,
    parent_email = $email,
    password = crypto::argon2::generate($password),
    coppa_consent_date = time::now(),
    privacy_preferences = $privacy_settings;

-- Child profile with family relationship
CREATE child_profiles SET
    family_id = $family_id,
    name = $child_name,
    age_group = $age_group,
    parental_controls = $privacy_controls;

-- Session with family context
CREATE auth_sessions SET
    user_id = $user_id,
    user_type = $user_type,
    family_id = $family_id,
    child_id = $child_id,
    expires_at = time::now() + $session_duration;
```

## Real-Time Progress Service

**Responsibility:** Live progress tracking, parental dashboards, achievement notifications

**SurrealDB Features Used:**
- Live queries for real-time progress updates
- Time-series data for learning analytics
- Graph relationships for skill dependencies

```sql
-- Live query for real-time progress dashboard
LIVE SELECT 
    child_id,
    subject,
    COUNT(*) as session_count,
    AVG(attention_metrics.focus_score) as avg_focus,
    time::group(start_time, '1d') as date
FROM learning_sessions 
WHERE child_id.family_id = $family_id 
    AND start_time > time::now() - 7d
GROUP BY child_id, subject, date;

-- Real-time skill mastery updates
LIVE SELECT 
    skill_name,
    mastery_level,
    success_rate,
    last_practiced
FROM skill_mastery 
WHERE child_id = $child_id
    AND last_practiced > time::now() - 1h;
```

## Intelligent Learning Service

**Responsibility:** AI-powered learning recommendations, curriculum adaptation

**SurrealDB Features Used:**
- Graph traversal for prerequisite checking
- Vector similarity for content recommendations
- ML integration with SurrealDB

```sql
-- Find next recommended topics based on mastered skills
SELECT topic.*, path.dependency_strength
FROM curriculum_topics as topic
LET path = (
    SELECT * FROM $parent<-prerequisite<-skill_mastery 
    WHERE child_id = $child_id AND mastery_level = 'proficient'
) as next_topics
FROM skill_mastery 
WHERE child_id = $child_id AND mastery_level = 'proficient'
FETCH next_topics;

-- Vector similarity search for related content
SELECT *, vector::similarity::cosine(content_embedding, $query_embedding) as similarity
FROM curriculum_topics 
WHERE vector::similarity::cosine(content_embedding, $query_embedding) > 0.8
ORDER BY similarity DESC
LIMIT 5;
```

## Assessment Service (Vector + ML Integration)

**Responsibility:** Camera-based work analysis with SurrealDB vector storage for pattern recognition

**SurrealDB Features Used:**
- Vector embeddings for work pattern recognition
- ML model integration for assessment analysis
- Document storage for assessment metadata

```sql
-- Store assessment with embedding for similarity matching
CREATE assessment_results SET
    child_id = $child_id,
    session_id = $session_id,
    work_image_base64 = $image_data,
    ocr_text = $extracted_text,
    assessment_embedding = $work_embedding,
    accuracy_score = $score,
    feedback_text = $feedback;

-- Find similar past work for pattern analysis
SELECT *, vector::similarity::cosine(assessment_embedding, $current_embedding) as similarity
FROM assessment_results
WHERE child_id = $child_id AND similarity > 0.7
ORDER BY similarity DESC;
```