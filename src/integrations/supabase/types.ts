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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      abandoned_checkouts: {
        Row: {
          checkout_id: string
          created_at: string
          email: string
          id: string
          name: string | null
          phone: string | null
          recovered: boolean
          recovery_token: string | null
          token_expires_at: string | null
          utm_data: Json | null
          whatsapp_sent_at: string | null
        }
        Insert: {
          checkout_id: string
          created_at?: string
          email: string
          id?: string
          name?: string | null
          phone?: string | null
          recovered?: boolean
          recovery_token?: string | null
          token_expires_at?: string | null
          utm_data?: Json | null
          whatsapp_sent_at?: string | null
        }
        Update: {
          checkout_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          phone?: string | null
          recovered?: boolean
          recovery_token?: string | null
          token_expires_at?: string | null
          utm_data?: Json | null
          whatsapp_sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "abandoned_checkouts_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
        ]
      }
      checkouts: {
        Row: {
          accent_color: string | null
          active: boolean
          banner_url: string | null
          bg_color: string | null
          checkout_slug: string
          created_at: string
          cta_text: string | null
          first_offer_id: string | null
          headline_text: string | null
          id: string
          name: string
          order_bump_product_id: string | null
          primary_color: string | null
          product_id: string
          redirect_url: string
          show_product_image: boolean | null
        }
        Insert: {
          accent_color?: string | null
          active?: boolean
          banner_url?: string | null
          bg_color?: string | null
          checkout_slug: string
          created_at?: string
          cta_text?: string | null
          first_offer_id?: string | null
          headline_text?: string | null
          id?: string
          name: string
          order_bump_product_id?: string | null
          primary_color?: string | null
          product_id: string
          redirect_url: string
          show_product_image?: boolean | null
        }
        Update: {
          accent_color?: string | null
          active?: boolean
          banner_url?: string | null
          bg_color?: string | null
          checkout_slug?: string
          created_at?: string
          cta_text?: string | null
          first_offer_id?: string | null
          headline_text?: string | null
          id?: string
          name?: string
          order_bump_product_id?: string | null
          primary_color?: string | null
          product_id?: string
          redirect_url?: string
          show_product_image?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "checkouts_first_offer_id_fkey"
            columns: ["first_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_order_bump_product_id_fkey"
            columns: ["order_bump_product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "checkouts_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string
          phone: string | null
          stripe_customer_id: string | null
          stripe_payment_method_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string
          phone?: string | null
          stripe_customer_id?: string | null
          stripe_payment_method_id?: string | null
        }
        Relationships: []
      }
      deliveries: {
        Row: {
          created_at: string
          id: string
          message: string | null
          order_id: string
          order_item_id: string
          phone: string | null
          status: Database["public"]["Enums"]["delivery_status"]
        }
        Insert: {
          created_at?: string
          id?: string
          message?: string | null
          order_id: string
          order_item_id: string
          phone?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Update: {
          created_at?: string
          id?: string
          message?: string | null
          order_id?: string
          order_item_id?: string
          phone?: string | null
          status?: Database["public"]["Enums"]["delivery_status"]
        }
        Relationships: [
          {
            foreignKeyName: "deliveries_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deliveries_order_item_id_fkey"
            columns: ["order_item_id"]
            isOneToOne: false
            referencedRelation: "order_items"
            referencedColumns: ["id"]
          },
        ]
      }
      offer_sessions: {
        Row: {
          created_at: string
          customer_id: string
          decided_at: string | null
          decision: string | null
          expires_at: string
          id: string
          offer_id: string
          order_id: string
          stripe_payment_intent_id: string | null
          token: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          offer_id: string
          order_id: string
          stripe_payment_intent_id?: string | null
          token?: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          decided_at?: string | null
          decision?: string | null
          expires_at?: string
          id?: string
          offer_id?: string
          order_id?: string
          stripe_payment_intent_id?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "offer_sessions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_sessions_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offer_sessions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      offers: {
        Row: {
          accept_next_offer_id: string | null
          created_at: string
          id: string
          iframe_id: string | null
          name: string
          page_url: string | null
          product_id: string
          reject_next_offer_id: string | null
        }
        Insert: {
          accept_next_offer_id?: string | null
          created_at?: string
          id?: string
          iframe_id?: string | null
          name: string
          page_url?: string | null
          product_id: string
          reject_next_offer_id?: string | null
        }
        Update: {
          accept_next_offer_id?: string | null
          created_at?: string
          id?: string
          iframe_id?: string | null
          name?: string
          page_url?: string | null
          product_id?: string
          reject_next_offer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "offers_accept_next_offer_id_fkey"
            columns: ["accept_next_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "offers_reject_next_offer_id_fkey"
            columns: ["reject_next_offer_id"]
            isOneToOne: false
            referencedRelation: "offers"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          amount: number
          id: string
          order_id: string
          product_id: string
          type: Database["public"]["Enums"]["order_item_type"]
        }
        Insert: {
          amount: number
          id?: string
          order_id: string
          product_id: string
          type?: Database["public"]["Enums"]["order_item_type"]
        }
        Update: {
          amount?: number
          id?: string
          order_id?: string
          product_id?: string
          type?: Database["public"]["Enums"]["order_item_type"]
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          checkout_id: string
          created_at: string
          customer_id: string
          id: string
          status: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id: string | null
          total_amount: number
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          checkout_id: string
          created_at?: string
          customer_id: string
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          total_amount: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          checkout_id?: string
          created_at?: string
          customer_id?: string
          id?: string
          status?: Database["public"]["Enums"]["order_status"]
          stripe_payment_intent_id?: string | null
          total_amount?: number
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_checkout_id_fkey"
            columns: ["checkout_id"]
            isOneToOne: false
            referencedRelation: "checkouts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          currency: string
          delivery_attachment: string | null
          delivery_message: string | null
          delivery_type: Database["public"]["Enums"]["delivery_type"]
          description: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          stripe_price_id: string | null
          stripe_product_id: string | null
          type: Database["public"]["Enums"]["product_type"]
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string
          delivery_attachment?: string | null
          delivery_message?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          price: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          type?: Database["public"]["Enums"]["product_type"]
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string
          delivery_attachment?: string | null
          delivery_message?: string | null
          delivery_type?: Database["public"]["Enums"]["delivery_type"]
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          type?: Database["public"]["Enums"]["product_type"]
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          id: string
          processed_at: string
        }
        Insert: {
          id: string
          processed_at?: string
        }
        Update: {
          id?: string
          processed_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      delivery_status: "pending" | "sent" | "failed"
      delivery_type: "whatsapp" | "email" | "none"
      order_item_type: "main" | "bump" | "upsell"
      order_status: "pending" | "paid" | "failed" | "refunded"
      product_type: "digital" | "physical" | "service"
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
      delivery_status: ["pending", "sent", "failed"],
      delivery_type: ["whatsapp", "email", "none"],
      order_item_type: ["main", "bump", "upsell"],
      order_status: ["pending", "paid", "failed", "refunded"],
      product_type: ["digital", "physical", "service"],
    },
  },
} as const
