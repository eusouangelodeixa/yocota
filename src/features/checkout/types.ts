export interface BumpProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  bump_description: string | null;
}

export interface CheckoutData {
  id: string;
  name: string;
  checkout_slug: string;
  redirect_url: string;
  product_id: string;
  primary_color: string;
  accent_color: string;
  bg_color: string;
  cta_button_color: string | null;
  headline_text: string | null;
  cta_text: string;
  banner_url: string | null;
  show_product_image: boolean;
  first_offer_id: string | null;
  product: { id: string; name: string; description: string | null; price: number; currency: string; image_url: string | null };
  bump_products: BumpProduct[];
  countdown_enabled: boolean;
  countdown_duration: number;
  countdown_text: string;
  countdown_bg_color: string;
  countdown_text_color: string;
  social_proof_enabled: boolean;
  social_proof_messages: string[];
  social_proof_interval: number;
  social_proof_display_duration: number;
  social_proof_position: "bottom-left" | "bottom-right";
}
