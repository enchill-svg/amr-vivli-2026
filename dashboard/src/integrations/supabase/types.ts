export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      alerts: {
        Row: {
          country: string;
          created_at: string;
          created_by: string | null;
          description: string | null;
          detected_at: string;
          id: string;
          pathogen: string;
          resolved_at: string | null;
          severity: Database["public"]["Enums"]["alert_severity"];
          status: Database["public"]["Enums"]["alert_status"];
          title: string;
          updated_at: string;
        };
        Insert: {
          country: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          detected_at?: string;
          id?: string;
          pathogen: string;
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["alert_severity"];
          status?: Database["public"]["Enums"]["alert_status"];
          title: string;
          updated_at?: string;
        };
        Update: {
          country?: string;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          detected_at?: string;
          id?: string;
          pathogen?: string;
          resolved_at?: string | null;
          severity?: Database["public"]["Enums"]["alert_severity"];
          status?: Database["public"]["Enums"]["alert_status"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      approval_requests: {
        Row: {
          created_at: string;
          id: string;
          reason: string | null;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: Database["public"]["Enums"]["user_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          reason?: string | null;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_email: string | null;
          created_at: string;
          device: string | null;
          entity: string | null;
          entity_id: string | null;
          id: string;
          ip_address: string | null;
          location: string | null;
          metadata: Json | null;
          user_id: string | null;
        };
        Insert: {
          action: string;
          actor_email?: string | null;
          created_at?: string;
          device?: string | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          ip_address?: string | null;
          location?: string | null;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          actor_email?: string | null;
          created_at?: string;
          device?: string | null;
          entity?: string | null;
          entity_id?: string | null;
          id?: string;
          ip_address?: string | null;
          location?: string | null;
          metadata?: Json | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          country: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          institution: string | null;
          profession: string | null;
          status: Database["public"]["Enums"]["user_status"];
          status_changed_at: string | null;
          status_changed_by: string | null;
          title: string | null;
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          institution?: string | null;
          profession?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          institution?: string | null;
          profession?: string | null;
          status?: Database["public"]["Enums"]["user_status"];
          status_changed_at?: string | null;
          status_changed_by?: string | null;
          title?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      samples: {
        Row: {
          collected_at: string;
          created_at: string;
          created_by: string | null;
          ct_value: number | null;
          id: string;
          notes: string | null;
          pathogen: string;
          site_id: string;
          viral_load: number | null;
          volume_ml: number | null;
        };
        Insert: {
          collected_at?: string;
          created_at?: string;
          created_by?: string | null;
          ct_value?: number | null;
          id?: string;
          notes?: string | null;
          pathogen: string;
          site_id: string;
          viral_load?: number | null;
          volume_ml?: number | null;
        };
        Update: {
          collected_at?: string;
          created_at?: string;
          created_by?: string | null;
          ct_value?: number | null;
          id?: string;
          notes?: string | null;
          pathogen?: string;
          site_id?: string;
          viral_load?: number | null;
          volume_ml?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "samples_site_id_fkey";
            columns: ["site_id"];
            isOneToOne: false;
            referencedRelation: "sentinel_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      sentinel_sites: {
        Row: {
          city: string | null;
          country: string;
          created_at: string;
          created_by: string | null;
          id: string;
          latitude: number | null;
          longitude: number | null;
          name: string;
          population_served: number | null;
          status: Database["public"]["Enums"]["site_status"];
          updated_at: string;
        };
        Insert: {
          city?: string | null;
          country: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name: string;
          population_served?: number | null;
          status?: Database["public"]["Enums"]["site_status"];
          updated_at?: string;
        };
        Update: {
          city?: string | null;
          country?: string;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          latitude?: number | null;
          longitude?: number | null;
          name?: string;
          population_served?: number | null;
          status?: Database["public"]["Enums"]["site_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      sequences: {
        Row: {
          accession: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          length_bp: number | null;
          lineage: string | null;
          pathogen: string;
          quality_score: number | null;
          sample_id: string | null;
          sequenced_at: string;
        };
        Insert: {
          accession?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          length_bp?: number | null;
          lineage?: string | null;
          pathogen: string;
          quality_score?: number | null;
          sample_id?: string | null;
          sequenced_at?: string;
        };
        Update: {
          accession?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          length_bp?: number | null;
          lineage?: string | null;
          pathogen?: string;
          quality_score?: number | null;
          sample_id?: string | null;
          sequenced_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "sequences_sample_id_fkey";
            columns: ["sample_id"];
            isOneToOne: false;
            referencedRelation: "samples";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      variants: {
        Row: {
          alt_aa: string | null;
          created_at: string;
          gene: string;
          id: string;
          impact: Database["public"]["Enums"]["variant_impact"];
          mutation: string;
          notes: string | null;
          position: number;
          ref_aa: string | null;
          sequence_id: string | null;
        };
        Insert: {
          alt_aa?: string | null;
          created_at?: string;
          gene: string;
          id?: string;
          impact?: Database["public"]["Enums"]["variant_impact"];
          mutation: string;
          notes?: string | null;
          position: number;
          ref_aa?: string | null;
          sequence_id?: string | null;
        };
        Update: {
          alt_aa?: string | null;
          created_at?: string;
          gene?: string;
          id?: string;
          impact?: Database["public"]["Enums"]["variant_impact"];
          mutation?: string;
          notes?: string | null;
          position?: number;
          ref_aa?: string | null;
          sequence_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "variants_sequence_id_fkey";
            columns: ["sequence_id"];
            isOneToOne: false;
            referencedRelation: "sequences";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_admin: { Args: { _user_id: string }; Returns: boolean };
      is_approved: { Args: { _user_id: string }; Returns: boolean };
    };
    Enums: {
      alert_severity: "low" | "moderate" | "high" | "very_high" | "extreme";
      alert_status: "active" | "investigating" | "resolved";
      app_role:
        | "admin"
        | "researcher"
        | "viewer"
        | "super_admin"
        | "analyst"
        | "public_health_officer";
      site_status: "active" | "paused" | "planned";
      user_status: "pending" | "approved" | "rejected" | "suspended";
      variant_impact: "low" | "moderate" | "high" | "critical";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      alert_severity: ["low", "moderate", "high", "very_high", "extreme"],
      alert_status: ["active", "investigating", "resolved"],
      app_role: [
        "admin",
        "researcher",
        "viewer",
        "super_admin",
        "analyst",
        "public_health_officer",
      ],
      site_status: ["active", "paused", "planned"],
      user_status: ["pending", "approved", "rejected", "suspended"],
      variant_impact: ["low", "moderate", "high", "critical"],
    },
  },
} as const;
