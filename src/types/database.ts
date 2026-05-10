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
      content_external_ids: {
        Row: {
          api_source: Database["public"]["Enums"]["external_source"]
          content_id: string
          created_at: string
          external_id: string
          id: string
          updated_at: string
        }
        Insert: {
          api_source: Database["public"]["Enums"]["external_source"]
          content_id: string
          created_at?: string
          external_id: string
          id?: string
          updated_at?: string
        }
        Update: {
          api_source?: Database["public"]["Enums"]["external_source"]
          content_id?: string
          created_at?: string
          external_id?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_external_ids_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      content_genres: {
        Row: {
          content_id: string
          genre_id: string
        }
        Insert: {
          content_id: string
          genre_id: string
        }
        Update: {
          content_id?: string
          genre_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_genres_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_genres_genre_id_fkey"
            columns: ["genre_id"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["id"]
          },
        ]
      }
      content_titles: {
        Row: {
          content_id: string
          created_at: string
          id: string
          language_code: string
          title: string
          updated_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          id?: string
          language_code: string
          title: string
          updated_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          id?: string
          language_code?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "content_titles_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      contents: {
        Row: {
          air_year: number | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          overview: string | null
          poster_url: string | null
          source_api: Database["public"]["Enums"]["external_source"]
          source_id: string
          title_original: string | null
          title_primary: string
          updated_at: string
        }
        Insert: {
          air_year?: number | null
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          overview?: string | null
          poster_url?: string | null
          source_api: Database["public"]["Enums"]["external_source"]
          source_id: string
          title_original?: string | null
          title_primary: string
          updated_at?: string
        }
        Update: {
          air_year?: number | null
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string
          id?: string
          overview?: string | null
          poster_url?: string | null
          source_api?: Database["public"]["Enums"]["external_source"]
          source_id?: string
          title_original?: string | null
          title_primary?: string
          updated_at?: string
        }
        Relationships: []
      }
      episodes: {
        Row: {
          air_date: string | null
          content_id: string
          created_at: string
          duration_seconds: number | null
          episode_number: number
          id: string
          season_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          air_date?: string | null
          content_id: string
          created_at?: string
          duration_seconds?: number | null
          episode_number: number
          id?: string
          season_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          air_date?: string | null
          content_id?: string
          created_at?: string
          duration_seconds?: number | null
          episode_number?: number
          id?: string
          season_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "episodes_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "episodes_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      external_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          query_hash: string
          query_text: string
          response_json: Json
          source: Database["public"]["Enums"]["external_source"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          query_hash: string
          query_text: string
          response_json: Json
          source: Database["public"]["Enums"]["external_source"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          query_hash?: string
          query_text?: string
          response_json?: Json
          source?: Database["public"]["Enums"]["external_source"]
          updated_at?: string
        }
        Relationships: []
      }
      genres: {
        Row: {
          created_at: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      metadata_sync_logs: {
        Row: {
          api_source: Database["public"]["Enums"]["external_source"] | null
          content_id: string | null
          created_at: string
          error_message: string | null
          id: string
          operation: string
          request_payload: Json | null
          response_snapshot: Json | null
          status: string
          synced_at: string
          updated_at: string
        }
        Insert: {
          api_source?: Database["public"]["Enums"]["external_source"] | null
          content_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          operation: string
          request_payload?: Json | null
          response_snapshot?: Json | null
          status: string
          synced_at?: string
          updated_at?: string
        }
        Update: {
          api_source?: Database["public"]["Enums"]["external_source"] | null
          content_id?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          operation?: string
          request_payload?: Json | null
          response_snapshot?: Json | null
          status?: string
          synced_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "metadata_sync_logs_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          body: string | null
          content_id: string
          created_at: string
          id: string
          is_spoiler: boolean
          one_line_review: string | null
          rating: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          content_id: string
          created_at?: string
          id?: string
          is_spoiler?: boolean
          one_line_review?: string | null
          rating?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          content_id?: string
          created_at?: string
          id?: string
          is_spoiler?: boolean
          one_line_review?: string | null
          rating?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reviews_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      seasons: {
        Row: {
          air_year: number | null
          content_id: string
          created_at: string
          episode_count: number | null
          id: string
          season_number: number
          title: string | null
          updated_at: string
        }
        Insert: {
          air_year?: number | null
          content_id: string
          created_at?: string
          episode_count?: number | null
          id?: string
          season_number: number
          title?: string | null
          updated_at?: string
        }
        Update: {
          air_year?: number | null
          content_id?: string
          created_at?: string
          episode_count?: number | null
          id?: string
          season_number?: number
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "seasons_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      timeline_pin_tags: {
        Row: {
          created_at: string
          pin_id: string
          tag_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          pin_id: string
          tag_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          pin_id?: string
          tag_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_pin_tags_pin_id_fkey"
            columns: ["pin_id"]
            isOneToOne: false
            referencedRelation: "timeline_pins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_pin_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_pins: {
        Row: {
          content_id: string
          created_at: string
          display_time_label: string | null
          emotion: Database["public"]["Enums"]["emotion_type"] | null
          episode_id: string | null
          id: string
          is_spoiler: boolean
          memo: string | null
          timestamp_seconds: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          created_at?: string
          display_time_label?: string | null
          emotion?: Database["public"]["Enums"]["emotion_type"] | null
          episode_id?: string | null
          id?: string
          is_spoiler?: boolean
          memo?: string | null
          timestamp_seconds?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          created_at?: string
          display_time_label?: string | null
          emotion?: Database["public"]["Enums"]["emotion_type"] | null
          episode_id?: string | null
          id?: string
          is_spoiler?: boolean
          memo?: string | null
          timestamp_seconds?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "timeline_pins_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "timeline_pins_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_episode_progress: {
        Row: {
          content_id: string
          created_at: string
          episode_id: string
          id: string
          updated_at: string
          user_id: string
          watched_at: string
        }
        Insert: {
          content_id: string
          created_at?: string
          episode_id: string
          id?: string
          updated_at?: string
          user_id: string
          watched_at?: string
        }
        Update: {
          content_id?: string
          created_at?: string
          episode_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          watched_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_episode_progress_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_episode_progress_episode_id_fkey"
            columns: ["episode_id"]
            isOneToOne: false
            referencedRelation: "episodes"
            referencedColumns: ["id"]
          },
        ]
      }
      user_library_items: {
        Row: {
          added_at: string
          content_id: string
          id: string
          status: Database["public"]["Enums"]["watch_status"]
          status_flags: Database["public"]["Enums"]["watch_status"][]
          updated_at: string
          user_id: string
          watch_count: number
        }
        Insert: {
          added_at?: string
          content_id: string
          id?: string
          status?: Database["public"]["Enums"]["watch_status"]
          status_flags?: Database["public"]["Enums"]["watch_status"][]
          updated_at?: string
          user_id: string
          watch_count?: number
        }
        Update: {
          added_at?: string
          content_id?: string
          id?: string
          status?: Database["public"]["Enums"]["watch_status"]
          status_flags?: Database["public"]["Enums"]["watch_status"][]
          updated_at?: string
          user_id?: string
          watch_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_library_items_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "contents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_genre_stats: {
        Args: never
        Returns: {
          genre_name: string
          count: number
        }[]
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      content_type: "anime" | "kdrama" | "jdrama" | "movie" | "other"
      emotion_type:
        | "excited"
        | "moved"
        | "funny"
        | "sad"
        | "surprised"
        | "angry"
        | "scared"
        | "love"
        | "boring"
        | "none"
      external_source: "tmdb" | "anilist" | "kitsu" | "tvmaze" | "manual"
      watch_status: "wishlist" | "watching" | "completed" | "recommended" | "not_recommended" | "dropped"
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
      content_type: ["anime", "kdrama", "jdrama", "movie", "other"],
      emotion_type: [
        "excited",
        "moved",
        "funny",
        "sad",
        "surprised",
        "angry",
        "scared",
        "love",
        "boring",
        "none",
      ],
      external_source: ["tmdb", "anilist", "kitsu", "tvmaze", "manual"],
      watch_status: ["wishlist", "watching", "completed", "recommended", "not_recommended", "dropped"],
    },
  },
} as const
