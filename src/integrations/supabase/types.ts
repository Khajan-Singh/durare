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
      daily_sales: {
        Row: {
          catalog_item_id: string
          created_at: string
          id: string
          sale_date: string
          store_id: string
          units_sold: number
        }
        Insert: {
          catalog_item_id: string
          created_at?: string
          id?: string
          sale_date?: string
          store_id: string
          units_sold: number
        }
        Update: {
          catalog_item_id?: string
          created_at?: string
          id?: string
          sale_date?: string
          store_id?: string
          units_sold?: number
        }
        Relationships: [
          {
            foreignKeyName: "daily_sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      food_banks: {
        Row: {
          address: string | null
          capacity: number
          cold_storage: boolean
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
        }
        Insert: {
          address?: string | null
          capacity?: number
          cold_storage?: boolean
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
        }
        Update: {
          address?: string | null
          capacity?: number
          cold_storage?: boolean
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
        }
        Relationships: []
      }
      inventory_snapshots: {
        Row: {
          catalog_category_id: string | null
          catalog_item_id: string | null
          created_at: string
          date: string
          expiry_date: string
          id: string
          item_id: string
          qty_on_hand: number
          shelf_life_days: number | null
          store_id: string
        }
        Insert: {
          catalog_category_id?: string | null
          catalog_item_id?: string | null
          created_at?: string
          date?: string
          expiry_date: string
          id?: string
          item_id: string
          qty_on_hand: number
          shelf_life_days?: number | null
          store_id: string
        }
        Update: {
          catalog_category_id?: string | null
          catalog_item_id?: string | null
          created_at?: string
          date?: string
          expiry_date?: string
          id?: string
          item_id?: string
          qty_on_hand?: number
          shelf_life_days?: number | null
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "inventory_snapshots_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_snapshots_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      items: {
        Row: {
          category: string
          created_at: string
          id: string
          name: string
          shelf_life_days: number
        }
        Insert: {
          category: string
          created_at?: string
          id?: string
          name: string
          shelf_life_days?: number
        }
        Update: {
          category?: string
          created_at?: string
          id?: string
          name?: string
          shelf_life_days?: number
        }
        Relationships: []
      }
      pickups: {
        Row: {
          confirmed_by: string | null
          created_at: string
          food_bank_id: string
          id: string
          item_id: string
          quantity: number
          scheduled_date: string
          status: string
          store_id: string
        }
        Insert: {
          confirmed_by?: string | null
          created_at?: string
          food_bank_id: string
          id?: string
          item_id: string
          quantity?: number
          scheduled_date: string
          status?: string
          store_id: string
        }
        Update: {
          confirmed_by?: string | null
          created_at?: string
          food_bank_id?: string
          id?: string
          item_id?: string
          quantity?: number
          scheduled_date?: string
          status?: string
          store_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pickups_food_bank_id_fkey"
            columns: ["food_bank_id"]
            isOneToOne: false
            referencedRelation: "food_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickups_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pickups_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          attribution: Json
          category: string | null
          confidence_high: number | null
          confidence_low: number | null
          created_at: string
          drivers: string | null
          expiry_date: string | null
          id: string
          item_id: string
          model_version: string | null
          predicted_surplus_qty: number | null
          qty_on_hand: number | null
          sales_q10: number | null
          sales_q50: number | null
          sales_q90: number | null
          snapshot_date: string | null
          state: string | null
          store_id: string
          target_date: string | null
        }
        Insert: {
          attribution?: Json
          category?: string | null
          confidence_high?: number | null
          confidence_low?: number | null
          created_at?: string
          drivers?: string | null
          expiry_date?: string | null
          id?: string
          item_id: string
          model_version?: string | null
          predicted_surplus_qty?: number | null
          qty_on_hand?: number | null
          sales_q10?: number | null
          sales_q50?: number | null
          sales_q90?: number | null
          snapshot_date?: string | null
          state?: string | null
          store_id: string
          target_date?: string | null
        }
        Update: {
          attribution?: Json
          category?: string | null
          confidence_high?: number | null
          confidence_low?: number | null
          created_at?: string
          drivers?: string | null
          expiry_date?: string | null
          id?: string
          item_id?: string
          model_version?: string | null
          predicted_surplus_qty?: number | null
          qty_on_hand?: number | null
          sales_q10?: number | null
          sales_q50?: number | null
          sales_q90?: number | null
          snapshot_date?: string | null
          state?: string | null
          store_id?: string
          target_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          food_bank_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          store_id: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          food_bank_id?: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          food_bank_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          store_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_food_bank_id_fkey"
            columns: ["food_bank_id"]
            isOneToOne: false
            referencedRelation: "food_banks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          id: string
          lat: number
          lng: number
          name: string
          state: string | null
          type: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          name: string
          state?: string | null
          type?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          name?: string
          state?: string | null
          type?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "retailer" | "coordinator"
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
      app_role: ["retailer", "coordinator"],
    },
  },
} as const
