export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      abac_policies: {
        Row: {
          created_at: string
          field_name: string | null
          field_path: string
          id: string
          is_masked: boolean | null
          masking_pattern: string | null
          resource: string | null
          role: string
          strategy: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string
          field_name?: string | null
          field_path: string
          id?: string
          is_masked?: boolean | null
          masking_pattern?: string | null
          resource?: string | null
          role: string
          strategy?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string
          field_name?: string | null
          field_path?: string
          id?: string
          is_masked?: boolean | null
          masking_pattern?: string | null
          resource?: string | null
          role?: string
          strategy?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      api_rate_limits: {
        Row: {
          provider: string
          rate_limit_remaining: number | null
          rate_limit_reset: string | null
          rate_limit_total: number | null
          updated_at: string | null
        }
        Insert: {
          provider: string
          rate_limit_remaining?: number | null
          rate_limit_reset?: string | null
          rate_limit_total?: number | null
          updated_at?: string | null
        }
        Update: {
          provider?: string
          rate_limit_remaining?: number | null
          rate_limit_reset?: string | null
          rate_limit_total?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
      applications: {
        Row: {
          additional_information: string | null
          availability_bucket: string | null
          availability_date: string | null
          candidate_uuid: string
          conflict_story: string | null
          consent_at: string | null
          consent_data_sharing: boolean
          cover_letter: string | null
          created_at: string
          expected_salary_max: number | null
          expected_salary_min: number | null
          experience_bucket: string | null
          experience_score: number | null
          github_embedding: string | null
          github_project: string | null
          github_score: number | null
          id: string
          job_posting_id: string
          motivation_other: string | null
          motivation_reason: string | null
          office_attendance: boolean | null
          overall_score: number | null
          portfolio_url: string | null
          preferred_talent_network: boolean | null
          proudest_project: string | null
          referral_source: string | null
          resume_id: string
          salary_basis: string | null
          salary_currency: string
          skill_ratings: Json
          status: string
          submitted_at: string
          summary_score: number | null
          updated_at: string
          work_authorization: boolean | null
          work_mode_pref: string[]
          work_style: string | null
        }
        Insert: {
          additional_information?: string | null
          availability_bucket?: string | null
          availability_date?: string | null
          candidate_uuid: string
          conflict_story?: string | null
          consent_at?: string | null
          consent_data_sharing?: boolean
          cover_letter?: string | null
          created_at?: string
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          experience_bucket?: string | null
          experience_score?: number | null
          github_embedding?: string | null
          github_project?: string | null
          github_score?: number | null
          id?: string
          job_posting_id: string
          motivation_other?: string | null
          motivation_reason?: string | null
          office_attendance?: boolean | null
          overall_score?: number | null
          portfolio_url?: string | null
          preferred_talent_network?: boolean | null
          proudest_project?: string | null
          referral_source?: string | null
          resume_id: string
          salary_basis?: string | null
          salary_currency?: string
          skill_ratings?: Json
          status?: string
          submitted_at?: string
          summary_score?: number | null
          updated_at?: string
          work_authorization?: boolean | null
          work_mode_pref?: string[]
          work_style?: string | null
        }
        Update: {
          additional_information?: string | null
          availability_bucket?: string | null
          availability_date?: string | null
          candidate_uuid?: string
          conflict_story?: string | null
          consent_at?: string | null
          consent_data_sharing?: boolean
          cover_letter?: string | null
          created_at?: string
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          experience_bucket?: string | null
          experience_score?: number | null
          github_embedding?: string | null
          github_project?: string | null
          github_score?: number | null
          id?: string
          job_posting_id?: string
          motivation_other?: string | null
          motivation_reason?: string | null
          office_attendance?: boolean | null
          overall_score?: number | null
          portfolio_url?: string | null
          preferred_talent_network?: boolean | null
          proudest_project?: string | null
          referral_source?: string | null
          resume_id?: string
          salary_basis?: string | null
          salary_currency?: string
          skill_ratings?: Json
          status?: string
          submitted_at?: string
          summary_score?: number | null
          updated_at?: string
          work_authorization?: boolean | null
          work_mode_pref?: string[]
          work_style?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_application_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "fk_application_job_posting"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "jobs_posting"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_application_resume"
            columns: ["resume_id"]
            isOneToOne: false
            referencedRelation: "resumes"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string | null
          candidate_uuid: string | null
          created_at: string | null
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action?: string | null
          candidate_uuid?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string | null
          candidate_uuid?: string | null
          created_at?: string | null
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      candidates: {
        Row: {
          address: string | null
          age_group: string | null
          created_at: string
          current_company: string | null
          current_location: string | null
          custom_pronouns: string | null
          cv_file_path: string | null
          disability_status: string | null
          education_level: string | null
          email: string | null
          faculty_program: string | null
          full_name: string | null
          gender_identity: string | null
          github_url: string | null
          github_username: string | null
          graduation_year: string | null
          linkedin_url: string | null
          military_status: string | null
          phone: string | null
          portfolio_url: string | null
          pronouns: string | null
          race: string[]
          resume_text: string | null
          salary_expectation: number | null
          status: string
          university: string | null
          updated_at: string
          uuid: string
          website_url: string | null
        }
        Insert: {
          address?: string | null
          age_group?: string | null
          created_at?: string
          current_company?: string | null
          current_location?: string | null
          custom_pronouns?: string | null
          cv_file_path?: string | null
          disability_status?: string | null
          education_level?: string | null
          email?: string | null
          faculty_program?: string | null
          full_name?: string | null
          gender_identity?: string | null
          github_url?: string | null
          github_username?: string | null
          graduation_year?: string | null
          linkedin_url?: string | null
          military_status?: string | null
          phone?: string | null
          portfolio_url?: string | null
          pronouns?: string | null
          race?: string[]
          resume_text?: string | null
          salary_expectation?: number | null
          status?: string
          university?: string | null
          updated_at?: string
          uuid: string
          website_url?: string | null
        }
        Update: {
          address?: string | null
          age_group?: string | null
          created_at?: string
          current_company?: string | null
          current_location?: string | null
          custom_pronouns?: string | null
          cv_file_path?: string | null
          disability_status?: string | null
          education_level?: string | null
          email?: string | null
          faculty_program?: string | null
          full_name?: string | null
          gender_identity?: string | null
          github_url?: string | null
          github_username?: string | null
          graduation_year?: string | null
          linkedin_url?: string | null
          military_status?: string | null
          phone?: string | null
          portfolio_url?: string | null
          pronouns?: string | null
          race?: string[]
          resume_text?: string | null
          salary_expectation?: number | null
          status?: string
          university?: string | null
          updated_at?: string
          uuid?: string
          website_url?: string | null
        }
        Relationships: []
      }
      confirmed_slots: {
        Row: {
          calendar_event_id: string | null
          candidate_uuid: string
          created_at: string
          email_notified: boolean
          end_time: string
          id: string
          interviewer_ids: string[]
          slack_notified: boolean
          start_time: string
        }
        Insert: {
          calendar_event_id?: string | null
          candidate_uuid: string
          created_at?: string
          email_notified?: boolean
          end_time: string
          id: string
          interviewer_ids?: string[]
          slack_notified?: boolean
          start_time: string
        }
        Update: {
          calendar_event_id?: string | null
          candidate_uuid?: string
          created_at?: string
          email_notified?: boolean
          end_time?: string
          id?: string
          interviewer_ids?: string[]
          slack_notified?: boolean
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_confirmed_slot_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
        ]
      }
      cv_reviews: {
        Row: {
          candidate_uuid: string
          created_at: string
          decision: Database["public"]["Enums"]["review_decision"]
          id: string
          review_text: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["role_type"]
          updated_at: string
        }
        Insert: {
          candidate_uuid: string
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          id?: string
          review_text?: string | null
          reviewer_id: string
          reviewer_role: Database["public"]["Enums"]["role_type"]
          updated_at?: string
        }
        Update: {
          candidate_uuid?: string
          created_at?: string
          decision?: Database["public"]["Enums"]["review_decision"]
          id?: string
          review_text?: string | null
          reviewer_id?: string
          reviewer_role?: Database["public"]["Enums"]["role_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_cv_review_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
          {
            foreignKeyName: "fk_cv_review_reviewer"
            columns: ["reviewer_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      embeddings: {
        Row: {
          created_at: string | null
          embedding: string
          enrichment_profile_id: string
          id: string
          model_name: string
          source_type: string
          text_content: string
        }
        Insert: {
          created_at?: string | null
          embedding: string
          enrichment_profile_id: string
          id?: string
          model_name?: string
          source_type: string
          text_content: string
        }
        Update: {
          created_at?: string | null
          embedding?: string
          enrichment_profile_id?: string
          id?: string
          model_name?: string
          source_type?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_embeddings_enrichment_profile"
            columns: ["enrichment_profile_id"]
            isOneToOne: false
            referencedRelation: "enrichment_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      enrichment_profiles: {
        Row: {
          candidate_uuid: string
          created_at: string | null
          enrichment_status: Database["public"]["Enums"]["enrichment_status"]
          experience: string | null
          id: string
          match_confidence_score: number | null
          score_increase: number | null
          semantic_tags: string[]
          skill_matrix: Json | null
          skills: string[]
          summary: string | null
          updated_at: string | null
        }
        Insert: {
          candidate_uuid: string
          created_at?: string | null
          enrichment_status?: Database["public"]["Enums"]["enrichment_status"]
          experience?: string | null
          id?: string
          match_confidence_score?: number | null
          score_increase?: number | null
          semantic_tags?: string[]
          skill_matrix?: Json | null
          skills?: string[]
          summary?: string | null
          updated_at?: string | null
        }
        Update: {
          candidate_uuid?: string
          created_at?: string | null
          enrichment_status?: Database["public"]["Enums"]["enrichment_status"]
          experience?: string | null
          id?: string
          match_confidence_score?: number | null
          score_increase?: number | null
          semantic_tags?: string[]
          skill_matrix?: Json | null
          skills?: string[]
          summary?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_enrichment_profile_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
        ]
      }
      github_profiles: {
        Row: {
          candidate_uuid: string
          created_at: string
          id: string
          public_repos_count: number
          readme_content: string | null
          repos: Json
          top_languages: Json
          updated_at: string
        }
        Insert: {
          candidate_uuid: string
          created_at?: string
          id?: string
          public_repos_count?: number
          readme_content?: string | null
          repos?: Json
          top_languages?: Json
          updated_at?: string
        }
        Update: {
          candidate_uuid?: string
          created_at?: string
          id?: string
          public_repos_count?: number
          readme_content?: string | null
          repos?: Json
          top_languages?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_github_profile_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
        ]
      }
      interviewers: {
        Row: {
          cal_connected: boolean
          calendar_api_key: string | null
          calendar_id: string
          calendar_refresh_token: string | null
          color: string
          created_at: string
          email: string
          id: string
          initials: string
          job_title: string
          name: string
          updated_at: string
        }
        Insert: {
          cal_connected?: boolean
          calendar_api_key?: string | null
          calendar_id?: string
          calendar_refresh_token?: string | null
          color: string
          created_at?: string
          email?: string
          id: string
          initials: string
          job_title: string
          name: string
          updated_at?: string
        }
        Update: {
          cal_connected?: boolean
          calendar_api_key?: string | null
          calendar_id?: string
          calendar_refresh_token?: string | null
          color?: string
          created_at?: string
          email?: string
          id?: string
          initials?: string
          job_title?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      job_embeddings: {
        Row: {
          created_at: string
          embedding: string
          id: string
          job_posting_id: string
          model_name: string
          source_type: string
          text_content: string
        }
        Insert: {
          created_at?: string
          embedding: string
          id?: string
          job_posting_id: string
          model_name?: string
          source_type: string
          text_content: string
        }
        Update: {
          created_at?: string
          embedding?: string
          id?: string
          job_posting_id?: string
          model_name?: string
          source_type?: string
          text_content?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_embeddings_job_posting_id_fkey"
            columns: ["job_posting_id"]
            isOneToOne: false
            referencedRelation: "jobs_posting"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs_posting: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          description: string | null
          employment_type: string | null
          expires_at: string | null
          id: string
          job_title: string
          key_responsibilities: string | null
          last_saved_at: string
          location: string | null
          must_have_skills: string[]
          nice_to_have_qualifications: string | null
          nice_to_have_skills: string[]
          posted_at: string | null
          requirements: string | null
          salary_max: number | null
          salary_min: number | null
          seniority_level: string | null
          status: string
          target_openings: number | null
          updated_at: string
          work_mode: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          job_title: string
          key_responsibilities?: string | null
          last_saved_at?: string
          location?: string | null
          must_have_skills?: string[]
          nice_to_have_qualifications?: string | null
          nice_to_have_skills?: string[]
          posted_at?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority_level?: string | null
          status?: string
          target_openings?: number | null
          updated_at?: string
          work_mode?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          description?: string | null
          employment_type?: string | null
          expires_at?: string | null
          id?: string
          job_title?: string
          key_responsibilities?: string | null
          last_saved_at?: string
          location?: string | null
          must_have_skills?: string[]
          nice_to_have_qualifications?: string | null
          nice_to_have_skills?: string[]
          posted_at?: string | null
          requirements?: string | null
          salary_max?: number | null
          salary_min?: number | null
          seniority_level?: string | null
          status?: string
          target_openings?: number | null
          updated_at?: string
          work_mode?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_jobs_posting_created_by"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      linkedin_profiles: {
        Row: {
          avatar_url: string | null
          candidate_uuid: string
          certifications: Json
          created_at: string
          educations: Json
          experiences: Json
          full_name: string | null
          headline: string | null
          id: string
          profile_url: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          candidate_uuid: string
          certifications?: Json
          created_at?: string
          educations?: Json
          experiences?: Json
          full_name?: string | null
          headline?: string | null
          id?: string
          profile_url?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          candidate_uuid?: string
          certifications?: Json
          created_at?: string
          educations?: Json
          experiences?: Json
          full_name?: string | null
          headline?: string | null
          id?: string
          profile_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_linkedin_profile_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
        ]
      }
      llm_usage_logs: {
        Row: {
          completion_tokens: number | null
          created_at: string | null
          estimated_cost: number | null
          id: string
          model_name: string | null
          operation_type: string | null
          prompt_tokens: number | null
          total_tokens: number | null
          user_id: string | null
        }
        Insert: {
          completion_tokens?: number | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          model_name?: string | null
          operation_type?: string | null
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          completion_tokens?: number | null
          created_at?: string | null
          estimated_cost?: number | null
          id?: string
          model_name?: string | null
          operation_type?: string | null
          prompt_tokens?: number | null
          total_tokens?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      resumes: {
        Row: {
          candidate_uuid: string
          created_at: string
          file_path: string | null
          filename: string | null
          id: string
          text_content: string | null
        }
        Insert: {
          candidate_uuid: string
          created_at?: string
          file_path?: string | null
          filename?: string | null
          id?: string
          text_content?: string | null
        }
        Update: {
          candidate_uuid?: string
          created_at?: string
          file_path?: string | null
          filename?: string | null
          id?: string
          text_content?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_resume_candidate"
            columns: ["candidate_uuid"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["uuid"]
          },
        ]
      }
      universities: {
        Row: {
          alpha_two_code: string | null
          country: string
          domains: string[] | null
          id: number
          name: string
          state_province: string | null
          web_pages: string[] | null
        }
        Insert: {
          alpha_two_code?: string | null
          country: string
          domains?: string[] | null
          id?: number
          name: string
          state_province?: string | null
          web_pages?: string[] | null
        }
        Update: {
          alpha_two_code?: string | null
          country?: string
          domains?: string[] | null
          id?: number
          name?: string
          state_province?: string | null
          web_pages?: string[] | null
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          created_at: string | null
          expires_at: string | null
          id: string
          ip_address: string | null
          is_revoked: boolean | null
          token_jti: string | null
          updated_at: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_revoked?: boolean | null
          token_jti?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          expires_at?: string | null
          id?: string
          ip_address?: string | null
          is_revoked?: boolean | null
          token_jti?: string | null
          updated_at?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string
          email: string
          id: string
          is_active: boolean
          is_approved: boolean
          name: string
          password_hash: string | null
          picture: string | null
          role: Database["public"]["Enums"]["role_type"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          name: string
          password_hash?: string | null
          picture?: string | null
          role: Database["public"]["Enums"]["role_type"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          name?: string
          password_hash?: string | null
          picture?: string | null
          role?: Database["public"]["Enums"]["role_type"]
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_candidate_ids_by_skills: {
        Args: { required_skills: string[] }
        Returns: {
          candidate_uuid: string
        }[]
      }
      search_github_projects_lexically: {
        Args: { p_candidate_uuid: string; p_query: string; p_top_k?: number }
        Returns: {
          candidate_uuid: string
          description: string
          language: string
          lexical_score: number
          project_name: string
          topics: Json
        }[]
      }
      search_profiles_lexically: {
        Args: { candidate_ids?: string[]; query: string; top_k?: number }
        Returns: {
          candidate_uuid: string
          enrichment_profile_id: string
          lexical_score: number
          matched_fields: string
        }[]
      }
      search_similar_embeddings: {
        Args: {
          candidate_ids?: string[]
          minimum_similarity?: number
          query_embedding: string
          source_types?: string[]
          top_k?: number
        }
        Returns: {
          candidate_uuid: string
          enrichment_profile_id: string
          matched_text: string
          similarity_score: number
          source_type: string
        }[]
      }
    }
    Enums: {
      audit_action:
        | "CREATE"
        | "UPDATE"
        | "DELETE"
        | "LOGIN"
        | "LOGOUT"
        | "REVIEW_SUBMIT"
        | "REVIEW_RESOLVE"
        | "SLOT_CONFIRM"
        | "SCHEDULE_SEARCH"
        | "ENRICHMENT_START"
        | "ENRICHMENT_COMPLETE"
        | "CALENDAR_KEY_UPDATE"
        | "UPLOAD_RESUME"
        | "CANDIDATE_SEARCH"
      enrichment_status:
        | "QUEUED"
        | "IN_PROGRESS"
        | "ENRICHED"
        | "ENRICHMENT_FAILED"
        | "NO_PROFILES_FOUND"
      review_decision: "pending" | "approved" | "rejected"
      role_type:
        | "hr"
        | "tech_lead"
        | "admin"
        | "recruiter"
        | "interviewer"
        | "candidate"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      audit_action: [
        "CREATE",
        "UPDATE",
        "DELETE",
        "LOGIN",
        "LOGOUT",
        "REVIEW_SUBMIT",
        "REVIEW_RESOLVE",
        "SLOT_CONFIRM",
        "SCHEDULE_SEARCH",
        "ENRICHMENT_START",
        "ENRICHMENT_COMPLETE",
        "CALENDAR_KEY_UPDATE",
        "UPLOAD_RESUME",
        "CANDIDATE_SEARCH",
      ],
      enrichment_status: [
        "QUEUED",
        "IN_PROGRESS",
        "ENRICHED",
        "ENRICHMENT_FAILED",
        "NO_PROFILES_FOUND",
      ],
      review_decision: ["pending", "approved", "rejected"],
      role_type: [
        "hr",
        "tech_lead",
        "admin",
        "recruiter",
        "interviewer",
        "candidate",
      ],
    },
  },
} as const
