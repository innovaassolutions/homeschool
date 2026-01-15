# SurrealDB Data Models

SurrealDB's multi-model approach allows us to store different types of data optimally while maintaining relationships.

## User Management (Document + Relations)

```sql
-- Family and user profiles with embedded privacy settings
DEFINE TABLE families SCHEMAFULL;
DEFINE FIELD id ON families TYPE record<families>;
DEFINE FIELD parent_name ON families TYPE string;
DEFINE FIELD parent_email ON families TYPE string ASSERT string::is::email($value);
DEFINE FIELD subscription_tier ON families TYPE string DEFAULT 'free';
DEFINE FIELD privacy_preferences ON families TYPE object;
DEFINE FIELD billing_info ON families TYPE object;
DEFINE FIELD created_at ON families TYPE datetime DEFAULT time::now();

-- Child profiles with age-based configurations
DEFINE TABLE child_profiles SCHEMAFULL;
DEFINE FIELD id ON child_profiles TYPE record<child_profiles>;
DEFINE FIELD family_id ON child_profiles TYPE record<families>;
DEFINE FIELD name ON child_profiles TYPE string;
DEFINE FIELD age_group ON child_profiles TYPE string ASSERT $value IN ['ages6to9', 'ages10to13', 'ages14to16'];
DEFINE FIELD learning_style ON child_profiles TYPE string;
DEFINE FIELD interests ON child_profiles TYPE array<string>;
DEFINE FIELD accessibility_needs ON child_profiles TYPE array<string>;
DEFINE FIELD created_at ON child_profiles TYPE datetime DEFAULT time::now();
```

## Learning Progress (Relations + Time Series)

```sql
-- Learning sessions with real-time capabilities
DEFINE TABLE learning_sessions SCHEMAFULL;
DEFINE FIELD id ON learning_sessions TYPE record<learning_sessions>;
DEFINE FIELD child_id ON learning_sessions TYPE record<child_profiles>;
DEFINE FIELD subject ON learning_sessions TYPE string;
DEFINE FIELD topic ON learning_sessions TYPE string;
DEFINE FIELD start_time ON learning_sessions TYPE datetime DEFAULT time::now();
DEFINE FIELD end_time ON learning_sessions TYPE datetime;
DEFINE FIELD duration_minutes ON learning_sessions TYPE int;
DEFINE FIELD attention_metrics ON learning_sessions TYPE object; -- Focus, engagement scores
DEFINE FIELD voice_interactions ON learning_sessions TYPE array<object>; -- Voice conversation data
DEFINE FIELD completed_activities ON learning_sessions TYPE array<string>;
DEFINE FIELD struggle_points ON learning_sessions TYPE array<object>; -- Where child needed help

-- Progress tracking for individual skills
DEFINE TABLE skill_mastery SCHEMAFULL;
DEFINE FIELD id ON skill_mastery TYPE record<skill_mastery>;
DEFINE FIELD child_id ON skill_mastery TYPE record<child_profiles>;
DEFINE FIELD skill_id ON skill_mastery TYPE string;
DEFINE FIELD skill_name ON skill_mastery TYPE string;
DEFINE FIELD mastery_level ON skill_mastery TYPE string DEFAULT 'not_started';
DEFINE FIELD first_attempt ON skill_mastery TYPE datetime;
DEFINE FIELD last_practiced ON skill_mastery TYPE datetime;
DEFINE FIELD practice_count ON skill_mastery TYPE int DEFAULT 0;
DEFINE FIELD success_rate ON skill_mastery TYPE float DEFAULT 0.0;
DEFINE FIELD skill_embedding ON skill_mastery TYPE array<float>; -- Vector for recommendations

-- Graph relationships for skill dependencies
DEFINE TABLE requires SCHEMAFULL;
DEFINE FIELD in ON requires TYPE record<skill_mastery>;
DEFINE FIELD out ON requires TYPE record<skill_mastery>;
DEFINE FIELD dependency_strength ON requires TYPE float DEFAULT 1.0;

-- Index for vector similarity searches
DEFINE INDEX skill_vector_idx ON skill_mastery FIELDS skill_embedding MTREE DIMENSION 384;
```

## Curriculum and Content (Graph + Vector)

```sql
-- Curriculum topics with content embeddings
DEFINE TABLE curriculum_topics SCHEMAFULL;
DEFINE FIELD id ON curriculum_topics TYPE record<curriculum_topics>;
DEFINE FIELD subject ON curriculum_topics TYPE string;
DEFINE FIELD topic_name ON curriculum_topics TYPE string;
DEFINE FIELD difficulty_level ON curriculum_topics TYPE int ASSERT $value >= 1 AND $value <= 10;
DEFINE FIELD content_text ON curriculum_topics TYPE string;
DEFINE FIELD content_embedding ON curriculum_topics TYPE array<float>; -- Vector for similarity
DEFINE FIELD age_appropriateness ON curriculum_topics TYPE array<int>; -- [5,6,7,8,9,10,11,12,13]
DEFINE FIELD learning_objectives ON curriculum_topics TYPE array<string>;

-- Graph relationships for curriculum progression
DEFINE TABLE prerequisite SCHEMAFULL;
DEFINE FIELD in ON prerequisite TYPE record<curriculum_topics>;
DEFINE FIELD out ON prerequisite TYPE record<curriculum_topics>;
DEFINE FIELD prerequisite_strength ON prerequisite TYPE float DEFAULT 1.0;

-- Vector index for content similarity
DEFINE INDEX content_vector_idx ON curriculum_topics FIELDS content_embedding MTREE DIMENSION 384;
```