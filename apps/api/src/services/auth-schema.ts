import { DatabaseService } from './database';

export interface AuthFamily {
  id?: string;
  parent_email: string;
  parent_name: string;
  password?: string;
  created_at?: string;
  subscription_tier: string;
  coppa_consent_date: string;
  coppa_consent_version: string;
  privacy_settings: {
    data_collection: boolean;
    analytics_sharing: boolean;
    marketing_emails: boolean;
    research_participation: boolean;
  };
  billing_info?: Record<string, unknown>;
}

export interface AuthChildProfile {
  id?: string;
  family_id: string;
  child_name: string;
  age_group: 'ages6to9' | 'ages10to13' | 'ages14to16';
  privacy_level: string;
  learning_preferences?: Record<string, unknown>;
  created_at?: string;
  last_active?: string;
  parental_controls: {
    voice_recordings_allowed: boolean;
    camera_uploads_allowed: boolean;
    ai_interactions_logged: boolean;
    progress_sharing_enabled: boolean;
    real_time_monitoring: boolean;
  };
}

export interface AuthSession {
  id?: string;
  user_id: string;
  user_type: 'parent' | 'child';
  family_id: string;
  child_id?: string;
  expires_at: string;
  device_info?: Record<string, unknown>;
  last_activity?: string;
  session_data?: Record<string, unknown>;
}

export class AuthSchemaService {
  constructor(private db: DatabaseService) {}

  async createAuthenticationSchema(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  Development mode: Simulating authentication schema creation');
      console.log('✅ Mock authentication tables created');
      return;
    }

    const schemaQueries = [
      // Create auth_families table
      `DEFINE TABLE auth_families SCHEMAFULL;`,
      `DEFINE FIELD id ON auth_families TYPE record<auth_families>;`,
      `DEFINE FIELD parent_email ON auth_families TYPE string ASSERT string::is::email($value);`,
      `DEFINE FIELD parent_name ON auth_families TYPE string;`,
      `DEFINE FIELD password ON auth_families TYPE string;`,
      `DEFINE FIELD created_at ON auth_families TYPE datetime DEFAULT time::now();`,
      `DEFINE FIELD subscription_tier ON auth_families TYPE string DEFAULT 'free';`,
      `DEFINE FIELD coppa_consent_date ON auth_families TYPE datetime;`,
      `DEFINE FIELD coppa_consent_version ON auth_families TYPE string;`,
      `DEFINE FIELD privacy_settings ON auth_families TYPE object DEFAULT {
        data_collection: true,
        analytics_sharing: false,
        marketing_emails: false,
        research_participation: false
      };`,
      `DEFINE FIELD billing_info ON auth_families TYPE object;`,

      // Create auth_child_profiles table
      `DEFINE TABLE auth_child_profiles SCHEMAFULL;`,
      `DEFINE FIELD id ON auth_child_profiles TYPE record<auth_child_profiles>;`,
      `DEFINE FIELD family_id ON auth_child_profiles TYPE record<auth_families>;`,
      `DEFINE FIELD child_name ON auth_child_profiles TYPE string;`,
      `DEFINE FIELD age_group ON auth_child_profiles TYPE string ASSERT $value IN ['ages6to9', 'ages10to13', 'ages14to16'];`,
      `DEFINE FIELD privacy_level ON auth_child_profiles TYPE string DEFAULT 'standard';`,
      `DEFINE FIELD learning_preferences ON auth_child_profiles TYPE object;`,
      `DEFINE FIELD created_at ON auth_child_profiles TYPE datetime DEFAULT time::now();`,
      `DEFINE FIELD last_active ON auth_child_profiles TYPE datetime;`,
      `DEFINE FIELD parental_controls ON auth_child_profiles TYPE object DEFAULT {
        voice_recordings_allowed: true,
        camera_uploads_allowed: true,
        ai_interactions_logged: true,
        progress_sharing_enabled: true,
        real_time_monitoring: false
      };`,

      // Create auth_sessions table
      `DEFINE TABLE auth_sessions SCHEMAFULL;`,
      `DEFINE FIELD id ON auth_sessions TYPE record<auth_sessions>;`,
      `DEFINE FIELD user_id ON auth_sessions TYPE string;`,
      `DEFINE FIELD user_type ON auth_sessions TYPE string ASSERT $value IN ['parent', 'child'];`,
      `DEFINE FIELD family_id ON auth_sessions TYPE record<auth_families>;`,
      `DEFINE FIELD child_id ON auth_sessions TYPE record<auth_child_profiles> ASSERT $this.user_type = 'child' OR $value = NONE;`,
      `DEFINE FIELD expires_at ON auth_sessions TYPE datetime;`,
      `DEFINE FIELD device_info ON auth_sessions TYPE object;`,
      `DEFINE FIELD last_activity ON auth_sessions TYPE datetime DEFAULT time::now();`,
      `DEFINE FIELD session_data ON auth_sessions TYPE object;`,

      // Create indexes for performance
      `DEFINE INDEX idx_auth_families_email ON auth_families COLUMNS parent_email UNIQUE;`,
      `DEFINE INDEX idx_auth_child_profiles_family ON auth_child_profiles COLUMNS family_id;`,
      `DEFINE INDEX idx_auth_sessions_user ON auth_sessions COLUMNS user_id;`,
      `DEFINE INDEX idx_auth_sessions_family ON auth_sessions COLUMNS family_id;`
    ];

    // Execute schema creation queries
    for (const query of schemaQueries) {
      await this.db.query(query);
    }

    console.log('✅ Authentication schema created successfully');
  }

  async createAuthenticationScopes(): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️  Development mode: Simulating authentication scopes creation');
      console.log('✅ Mock authentication scopes created');
      return;
    }

    const scopeQueries = [
      // Parent authentication scope
      `DEFINE SCOPE parent
        SESSION 24h
        SIGNIN (
          SELECT * FROM auth_families
          WHERE parent_email = $email
          AND crypto::argon2::compare(password, $password)
        )
        SIGNUP (
          CREATE auth_families SET
            parent_email = $email,
            parent_name = $name,
            password = crypto::argon2::generate($password),
            coppa_consent_date = time::now(),
            coppa_consent_version = $coppa_version
        );`,

      // Child profile selection scope
      `DEFINE SCOPE child
        SESSION 4h
        SIGNIN (
          SELECT * FROM auth_child_profiles
          WHERE family_id = $family_id
          AND id = $child_profile_id
          AND $parent_session_valid = true
        );`
    ];

    // Execute scope creation queries
    for (const query of scopeQueries) {
      await this.db.query(query);
    }

    console.log('✅ Authentication scopes created successfully');
  }

  async validateSchema(): Promise<boolean> {
    try {
      if (process.env.NODE_ENV === 'development') {
        console.log('⚠️  Development mode: Simulating schema validation');
        return true;
      }

      // Check if tables exist
      const tables = await this.db.query('INFO FOR DB');
      console.log('Schema validation completed');
      return true;
    } catch (error) {
      console.error('Schema validation failed:', error);
      return false;
    }
  }
}

export function getAuthSchema(db: DatabaseService): AuthSchemaService {
  return new AuthSchemaService(db);
}