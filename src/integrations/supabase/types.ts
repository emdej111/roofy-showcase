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
      admin_actions: {
        Row: {
          action: string
          admin_id: string
          created_at: string
          id: string
          metadata: Json
          reason: string | null
          target_id: string
          target_type: string
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id: string
          target_type: string
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string
          id?: string
          metadata?: Json
          reason?: string | null
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      city_tax_rates: {
        Row: {
          city: string
          created_at: string
          id: string
          income_tax_rate: number
          lump_sum_deduction_rate: number
          notes: string | null
          surtax_rate: number
          updated_at: string
        }
        Insert: {
          city: string
          created_at?: string
          id?: string
          income_tax_rate?: number
          lump_sum_deduction_rate?: number
          notes?: string | null
          surtax_rate?: number
          updated_at?: string
        }
        Update: {
          city?: string
          created_at?: string
          id?: string
          income_tax_rate?: number
          lump_sum_deduction_rate?: number
          notes?: string | null
          surtax_rate?: number
          updated_at?: string
        }
        Relationships: []
      }
      contract_templates: {
        Row: {
          created_at: string
          description: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: []
      }
      favorites: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          tenant_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          tenant_id: string
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "favorites_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      inquiries: {
        Row: {
          budget_max: number | null
          closed_at: string | null
          created_at: string
          employment_status: string | null
          household_size: number | null
          id: string
          landlord_archived: boolean
          landlord_id: string
          listing_id: string
          message: string | null
          move_in_date: string | null
          pets: boolean | null
          rental_period_months: number | null
          status: Database["public"]["Enums"]["inquiry_status"]
          tenant_archived: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          budget_max?: number | null
          closed_at?: string | null
          created_at?: string
          employment_status?: string | null
          household_size?: number | null
          id?: string
          landlord_archived?: boolean
          landlord_id: string
          listing_id: string
          message?: string | null
          move_in_date?: string | null
          pets?: boolean | null
          rental_period_months?: number | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          tenant_archived?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          budget_max?: number | null
          closed_at?: string | null
          created_at?: string
          employment_status?: string | null
          household_size?: number | null
          id?: string
          landlord_archived?: boolean
          landlord_id?: string
          listing_id?: string
          message?: string | null
          move_in_date?: string | null
          pets?: boolean | null
          rental_period_months?: number | null
          status?: Database["public"]["Enums"]["inquiry_status"]
          tenant_archived?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "inquiries_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          listing_id: string | null
          package: string
          paid_at: string | null
          promo_code_id: string | null
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          package: string
          paid_at?: string | null
          promo_code_id?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          listing_id?: string | null
          package?: string
          paid_at?: string | null
          promo_code_id?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_payments_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_photos: {
        Row: {
          created_at: string
          display_order: number
          id: string
          listing_id: string
          url: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          listing_id: string
          url: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          listing_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "listing_photos_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_status_history: {
        Row: {
          changed_by: string | null
          created_at: string
          id: string
          listing_id: string
          new_status: Database["public"]["Enums"]["listing_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["listing_status"] | null
        }
        Insert: {
          changed_by?: string | null
          created_at?: string
          id?: string
          listing_id: string
          new_status: Database["public"]["Enums"]["listing_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["listing_status"] | null
        }
        Update: {
          changed_by?: string | null
          created_at?: string
          id?: string
          listing_id?: string
          new_status?: Database["public"]["Enums"]["listing_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["listing_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "listing_status_history_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      listing_views: {
        Row: {
          created_at: string
          id: string
          listing_id: string
          session_id: string | null
          viewer_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          listing_id: string
          session_id?: string | null
          viewer_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          listing_id?: string
          session_id?: string | null
          viewer_id?: string | null
        }
        Relationships: []
      }
      listings: {
        Row: {
          address: string
          air_conditioning: boolean | null
          appliance_dishwasher: boolean
          appliance_dryer: boolean
          appliance_fridge: boolean
          appliance_microwave: boolean
          appliance_oven: boolean
          appliance_washer: boolean
          approved_at: string | null
          approved_by: string | null
          auto_renew: boolean
          available_from: string | null
          balcony: boolean | null
          boost_until: string | null
          city: string
          condition: Database["public"]["Enums"]["condition_type"] | null
          created_at: string
          currency: Database["public"]["Enums"]["currency_type"]
          description: string | null
          elevator: boolean | null
          featured: boolean
          floor: number | null
          furnished: Database["public"]["Enums"]["furnished_type"] | null
          heating: Database["public"]["Enums"]["heating_type"] | null
          hidden: boolean
          hidden_reason: string | null
          id: string
          internet: boolean | null
          landlord_id: string
          latitude: number
          longitude: number
          min_rental_months: number | null
          notes: string | null
          paid_until: string | null
          parking: Database["public"]["Enums"]["parking_type"] | null
          payment_kind: string | null
          pets: Database["public"]["Enums"]["pets_policy"] | null
          postal_code: string | null
          price: number
          property_type: string | null
          rented_at: string | null
          rooms: number
          size_m2: number
          status: Database["public"]["Enums"]["listing_status"]
          storage_room: boolean | null
          suitable_for: Database["public"]["Enums"]["tenant_segment"][]
          title: string
          total_floors: number | null
          updated_at: string
          utilities_electricity: boolean
          utilities_gas: boolean
          utilities_internet: boolean
          utilities_water: boolean
          view_count: number
        }
        Insert: {
          address: string
          air_conditioning?: boolean | null
          appliance_dishwasher?: boolean
          appliance_dryer?: boolean
          appliance_fridge?: boolean
          appliance_microwave?: boolean
          appliance_oven?: boolean
          appliance_washer?: boolean
          approved_at?: string | null
          approved_by?: string | null
          auto_renew?: boolean
          available_from?: string | null
          balcony?: boolean | null
          boost_until?: string | null
          city: string
          condition?: Database["public"]["Enums"]["condition_type"] | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          description?: string | null
          elevator?: boolean | null
          featured?: boolean
          floor?: number | null
          furnished?: Database["public"]["Enums"]["furnished_type"] | null
          heating?: Database["public"]["Enums"]["heating_type"] | null
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          internet?: boolean | null
          landlord_id: string
          latitude: number
          longitude: number
          min_rental_months?: number | null
          notes?: string | null
          paid_until?: string | null
          parking?: Database["public"]["Enums"]["parking_type"] | null
          payment_kind?: string | null
          pets?: Database["public"]["Enums"]["pets_policy"] | null
          postal_code?: string | null
          price: number
          property_type?: string | null
          rented_at?: string | null
          rooms: number
          size_m2: number
          status?: Database["public"]["Enums"]["listing_status"]
          storage_room?: boolean | null
          suitable_for?: Database["public"]["Enums"]["tenant_segment"][]
          title: string
          total_floors?: number | null
          updated_at?: string
          utilities_electricity?: boolean
          utilities_gas?: boolean
          utilities_internet?: boolean
          utilities_water?: boolean
          view_count?: number
        }
        Update: {
          address?: string
          air_conditioning?: boolean | null
          appliance_dishwasher?: boolean
          appliance_dryer?: boolean
          appliance_fridge?: boolean
          appliance_microwave?: boolean
          appliance_oven?: boolean
          appliance_washer?: boolean
          approved_at?: string | null
          approved_by?: string | null
          auto_renew?: boolean
          available_from?: string | null
          balcony?: boolean | null
          boost_until?: string | null
          city?: string
          condition?: Database["public"]["Enums"]["condition_type"] | null
          created_at?: string
          currency?: Database["public"]["Enums"]["currency_type"]
          description?: string | null
          elevator?: boolean | null
          featured?: boolean
          floor?: number | null
          furnished?: Database["public"]["Enums"]["furnished_type"] | null
          heating?: Database["public"]["Enums"]["heating_type"] | null
          hidden?: boolean
          hidden_reason?: string | null
          id?: string
          internet?: boolean | null
          landlord_id?: string
          latitude?: number
          longitude?: number
          min_rental_months?: number | null
          notes?: string | null
          paid_until?: string | null
          parking?: Database["public"]["Enums"]["parking_type"] | null
          payment_kind?: string | null
          pets?: Database["public"]["Enums"]["pets_policy"] | null
          postal_code?: string | null
          price?: number
          property_type?: string | null
          rented_at?: string | null
          rooms?: number
          size_m2?: number
          status?: Database["public"]["Enums"]["listing_status"]
          storage_room?: boolean | null
          suitable_for?: Database["public"]["Enums"]["tenant_segment"][]
          title?: string
          total_floors?: number | null
          updated_at?: string
          utilities_electricity?: boolean
          utilities_gas?: boolean
          utilities_internet?: boolean
          utilities_water?: boolean
          view_count?: number
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          created_at: string
          email: string
          id: string
          ip_address: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          ip_address?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          created_at: string
          id: string
          inquiry_id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          inquiry_id: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          inquiry_id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_inquiry_id_fkey"
            columns: ["inquiry_id"]
            isOneToOne: false
            referencedRelation: "inquiries"
            referencedColumns: ["id"]
          },
        ]
      }
      mfa_recovery_codes: {
        Row: {
          code_hash: string
          created_at: string
          id: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          code_hash: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          code_hash?: string
          created_at?: string
          id?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          id: string
          link: string | null
          metadata: Json
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          id?: string
          link?: string | null
          metadata?: Json
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
        }
        Relationships: []
      }
      passport_access_requests: {
        Row: {
          created_at: string
          id: string
          landlord_id: string
          listing_id: string | null
          message: string | null
          passport_user_id: string
          responded_at: string | null
          status: Database["public"]["Enums"]["passport_access_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          landlord_id: string
          listing_id?: string | null
          message?: string | null
          passport_user_id: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["passport_access_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          landlord_id?: string
          listing_id?: string | null
          message?: string | null
          passport_user_id?: string
          responded_at?: string | null
          status?: Database["public"]["Enums"]["passport_access_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "passport_access_requests_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          agency_name: string | null
          avatar_path: string | null
          avatar_url: string | null
          banned: boolean
          banned_reason: string | null
          created_at: string
          full_name: string | null
          id: string
          is_verified: boolean
          landlord_type: Database["public"]["Enums"]["landlord_type"] | null
          oib: string | null
          phone: string | null
          updated_at: string
          verification_status: Database["public"]["Enums"]["verification_status"]
        }
        Insert: {
          agency_name?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          banned?: boolean
          banned_reason?: string | null
          created_at?: string
          full_name?: string | null
          id: string
          is_verified?: boolean
          landlord_type?: Database["public"]["Enums"]["landlord_type"] | null
          oib?: string | null
          phone?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Update: {
          agency_name?: string | null
          avatar_path?: string | null
          avatar_url?: string | null
          banned?: boolean
          banned_reason?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          is_verified?: boolean
          landlord_type?: Database["public"]["Enums"]["landlord_type"] | null
          oib?: string | null
          phone?: string | null
          updated_at?: string
          verification_status?: Database["public"]["Enums"]["verification_status"]
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          batch_label: string | null
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          kind: string
          max_uses: number
          times_used: number
        }
        Insert: {
          active?: boolean
          batch_label?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind: string
          max_uses?: number
          times_used?: number
        }
        Update: {
          active?: boolean
          batch_label?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          kind?: string
          max_uses?: number
          times_used?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          id: string
          listing_id: string | null
          promo_code_id: string
          redeemed_at: string
          user_id: string
        }
        Insert: {
          id?: string
          listing_id?: string | null
          promo_code_id: string
          redeemed_at?: string
          user_id: string
        }
        Update: {
          id?: string
          listing_id?: string | null
          promo_code_id?: string
          redeemed_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_redemptions_promo_code_id_fkey"
            columns: ["promo_code_id"]
            isOneToOne: false
            referencedRelation: "promo_codes"
            referencedColumns: ["id"]
          },
        ]
      }
      renter_passports: {
        Row: {
          bio: string | null
          created_at: string
          desired_duration_months: number | null
          employer: string | null
          employment_status: string | null
          has_pets: boolean | null
          household_size: number | null
          id: string
          is_public: boolean | null
          languages: string[] | null
          monthly_income_eur: number | null
          move_in_date: string | null
          occupation: string | null
          pet_description: string | null
          smoker: boolean | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bio?: string | null
          created_at?: string
          desired_duration_months?: number | null
          employer?: string | null
          employment_status?: string | null
          has_pets?: boolean | null
          household_size?: number | null
          id?: string
          is_public?: boolean | null
          languages?: string[] | null
          monthly_income_eur?: number | null
          move_in_date?: string | null
          occupation?: string | null
          pet_description?: string | null
          smoker?: boolean | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bio?: string | null
          created_at?: string
          desired_duration_months?: number | null
          employer?: string | null
          employment_status?: string | null
          has_pets?: boolean | null
          household_size?: number | null
          id?: string
          is_public?: boolean | null
          languages?: string[] | null
          monthly_income_eur?: number | null
          move_in_date?: string | null
          occupation?: string | null
          pet_description?: string | null
          smoker?: boolean | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          resolution_notes: string | null
          resolved_at: string | null
          resolved_by: string | null
          review_id: string
          status: Database["public"]["Enums"]["report_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          resolution_notes?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          review_id?: string
          status?: Database["public"]["Enums"]["report_status"]
          updated_at?: string
        }
        Relationships: []
      }
      reviews: {
        Row: {
          comment: string | null
          created_at: string
          direction: Database["public"]["Enums"]["review_direction"]
          id: string
          inquiry_id: string
          landlord_id: string
          listing_id: string
          rating: number
          tenant_id: string
          updated_at: string
        }
        Insert: {
          comment?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["review_direction"]
          id?: string
          inquiry_id: string
          landlord_id: string
          listing_id: string
          rating: number
          tenant_id: string
          updated_at?: string
        }
        Update: {
          comment?: string | null
          created_at?: string
          direction?: Database["public"]["Enums"]["review_direction"]
          id?: string
          inquiry_id?: string
          landlord_id?: string
          listing_id?: string
          rating?: number
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      roommate_profiles: {
        Row: {
          age: number | null
          bio: string | null
          budget_max: number | null
          budget_min: number | null
          city: string
          cleanliness:
            | Database["public"]["Enums"]["roommate_cleanliness"]
            | null
          created_at: string
          gender: Database["public"]["Enums"]["roommate_gender"] | null
          headline: string
          id: string
          is_active: boolean
          lifestyle: Database["public"]["Enums"]["roommate_lifestyle"] | null
          listing_id: string | null
          move_in_date: string | null
          neighborhood: string | null
          occupation: Database["public"]["Enums"]["roommate_occupation"] | null
          pets: boolean
          pets_ok: boolean
          preferred_gender:
            | Database["public"]["Enums"]["roommate_gender"]
            | null
          rental_period_months: number | null
          smoker: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          bio?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city: string
          cleanliness?:
            | Database["public"]["Enums"]["roommate_cleanliness"]
            | null
          created_at?: string
          gender?: Database["public"]["Enums"]["roommate_gender"] | null
          headline: string
          id?: string
          is_active?: boolean
          lifestyle?: Database["public"]["Enums"]["roommate_lifestyle"] | null
          listing_id?: string | null
          move_in_date?: string | null
          neighborhood?: string | null
          occupation?: Database["public"]["Enums"]["roommate_occupation"] | null
          pets?: boolean
          pets_ok?: boolean
          preferred_gender?:
            | Database["public"]["Enums"]["roommate_gender"]
            | null
          rental_period_months?: number | null
          smoker?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          bio?: string | null
          budget_max?: number | null
          budget_min?: number | null
          city?: string
          cleanliness?:
            | Database["public"]["Enums"]["roommate_cleanliness"]
            | null
          created_at?: string
          gender?: Database["public"]["Enums"]["roommate_gender"] | null
          headline?: string
          id?: string
          is_active?: boolean
          lifestyle?: Database["public"]["Enums"]["roommate_lifestyle"] | null
          listing_id?: string | null
          move_in_date?: string | null
          neighborhood?: string | null
          occupation?: Database["public"]["Enums"]["roommate_occupation"] | null
          pets?: boolean
          pets_ok?: boolean
          preferred_gender?:
            | Database["public"]["Enums"]["roommate_gender"]
            | null
          rental_period_months?: number | null
          smoker?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "roommate_profiles_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_searches: {
        Row: {
          created_at: string
          filters: Json
          id: string
          last_notified_at: string
          name: string
          notify_email: boolean
          tenant_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          filters?: Json
          id?: string
          last_notified_at?: string
          name: string
          notify_email?: boolean
          tenant_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          filters?: Json
          id?: string
          last_notified_at?: string
          name?: string
          notify_email?: boolean
          tenant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      security_audit_log: {
        Row: {
          created_at: string
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          addon_analytics: boolean
          addon_featured: boolean
          cancel_at_period_end: boolean
          created_at: string
          current_period_end: string | null
          id: string
          status: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id: string | null
          stripe_price_id: string | null
          stripe_subscription_id: string | null
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          addon_analytics?: boolean
          addon_featured?: boolean
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          addon_analytics?: boolean
          addon_featured?: boolean
          cancel_at_period_end?: boolean
          created_at?: string
          current_period_end?: string | null
          id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          stripe_customer_id?: string | null
          stripe_price_id?: string | null
          stripe_subscription_id?: string | null
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      verification_requests: {
        Row: {
          admin_notes: string | null
          agency_name: string | null
          created_at: string
          full_name: string
          id: string
          id_back_document_path: string | null
          id_document_path: string
          landlord_id: string
          oib: string | null
          proof_document_path: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["verification_status"]
          updated_at: string
        }
        Insert: {
          admin_notes?: string | null
          agency_name?: string | null
          created_at?: string
          full_name: string
          id?: string
          id_back_document_path?: string | null
          id_document_path: string
          landlord_id: string
          oib?: string | null
          proof_document_path?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
        }
        Update: {
          admin_notes?: string | null
          agency_name?: string | null
          created_at?: string
          full_name?: string
          id?: string
          id_back_document_path?: string | null
          id_document_path?: string
          landlord_id?: string
          oib?: string | null
          proof_document_path?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["verification_status"]
          updated_at?: string
        }
        Relationships: []
      }
      viewings: {
        Row: {
          created_at: string
          id: string
          landlord_id: string
          landlord_note: string | null
          listing_id: string
          proposed_at: string
          status: Database["public"]["Enums"]["viewing_status"]
          tenant_id: string
          tenant_note: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          landlord_id: string
          landlord_note?: string | null
          listing_id: string
          proposed_at: string
          status?: Database["public"]["Enums"]["viewing_status"]
          tenant_id: string
          tenant_note?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          landlord_id?: string
          landlord_note?: string | null
          listing_id?: string
          proposed_at?: string
          status?: Database["public"]["Enums"]["viewing_status"]
          tenant_id?: string
          tenant_note?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "viewings_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "listings"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      archive_stale_listings: { Args: never; Returns: number }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_inquiry_participant: {
        Args: { _inquiry_id: string; _user_id: string }
        Returns: boolean
      }
      landlord_listing_quota: { Args: { _user_id: string }; Returns: number }
      landlord_rating: {
        Args: { _landlord_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
      landlord_response_stats: {
        Args: { _landlord_id: string }
        Returns: {
          median_hours: number
          response_rate: number
          sample_size: number
        }[]
      }
      purge_old_audit_logs: { Args: never; Returns: number }
      purge_old_login_attempts: { Args: never; Returns: number }
      tenant_rating: {
        Args: { _tenant_id: string }
        Returns: {
          avg_rating: number
          review_count: number
        }[]
      }
    }
    Enums: {
      app_role: "landlord" | "tenant" | "admin"
      condition_type: "new" | "renovated" | "good" | "needs_renovation"
      currency_type: "EUR" | "HRK"
      furnished_type: "full" | "partial" | "none"
      heating_type:
        | "central"
        | "gas"
        | "electric"
        | "heat_pump"
        | "underfloor"
        | "none"
      inquiry_status: "pending" | "accepted" | "declined" | "archived"
      landlord_type: "private" | "agency"
      listing_status:
        | "available"
        | "reserved"
        | "rented"
        | "archived"
        | "under_review"
        | "expired"
      notification_type: "message" | "inquiry" | "saved_search_match" | "system"
      parking_type: "none" | "street" | "garage" | "private"
      passport_access_status: "pending" | "approved" | "declined" | "revoked"
      pets_policy: "yes" | "no" | "negotiable"
      report_status: "pending" | "resolved" | "dismissed"
      review_direction: "tenant_to_landlord" | "landlord_to_tenant"
      roommate_cleanliness: "relaxed" | "average" | "very_tidy"
      roommate_gender: "male" | "female" | "other" | "prefer_not_say"
      roommate_lifestyle: "quiet" | "balanced" | "social"
      roommate_occupation: "student" | "employed" | "self_employed" | "other"
      subscription_status:
        | "active"
        | "trialing"
        | "past_due"
        | "canceled"
        | "incomplete"
      subscription_tier: "free" | "pro" | "agency"
      tenant_segment:
        | "students"
        | "families"
        | "professionals"
        | "nomads"
        | "seniors"
        | "pet_owners"
      verification_status: "pending" | "approved" | "rejected"
      viewing_status:
        | "pending"
        | "approved"
        | "declined"
        | "completed"
        | "cancelled"
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
      app_role: ["landlord", "tenant", "admin"],
      condition_type: ["new", "renovated", "good", "needs_renovation"],
      currency_type: ["EUR", "HRK"],
      furnished_type: ["full", "partial", "none"],
      heating_type: [
        "central",
        "gas",
        "electric",
        "heat_pump",
        "underfloor",
        "none",
      ],
      inquiry_status: ["pending", "accepted", "declined", "archived"],
      landlord_type: ["private", "agency"],
      listing_status: [
        "available",
        "reserved",
        "rented",
        "archived",
        "under_review",
        "expired",
      ],
      notification_type: ["message", "inquiry", "saved_search_match", "system"],
      parking_type: ["none", "street", "garage", "private"],
      passport_access_status: ["pending", "approved", "declined", "revoked"],
      pets_policy: ["yes", "no", "negotiable"],
      report_status: ["pending", "resolved", "dismissed"],
      review_direction: ["tenant_to_landlord", "landlord_to_tenant"],
      roommate_cleanliness: ["relaxed", "average", "very_tidy"],
      roommate_gender: ["male", "female", "other", "prefer_not_say"],
      roommate_lifestyle: ["quiet", "balanced", "social"],
      roommate_occupation: ["student", "employed", "self_employed", "other"],
      subscription_status: [
        "active",
        "trialing",
        "past_due",
        "canceled",
        "incomplete",
      ],
      subscription_tier: ["free", "pro", "agency"],
      tenant_segment: [
        "students",
        "families",
        "professionals",
        "nomads",
        "seniors",
        "pet_owners",
      ],
      verification_status: ["pending", "approved", "rejected"],
      viewing_status: [
        "pending",
        "approved",
        "declined",
        "completed",
        "cancelled",
      ],
    },
  },
} as const
