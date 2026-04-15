/**
 * PixelInjector
 * Injects tracking pixels (Meta, TikTok, Google Ads, GTM) into the page
 * and fires the appropriate events based on the stage.
 *
 * Usage:
 *   <PixelInjector pixels={checkout} event="view" />          // on checkout load
 *   <PixelInjector pixels={checkout} event="purchase"         // on success page
 *     value={97.00} currency="BRL" orderId="abc-123" />
 */

import { useEffect } from "react";

export interface PixelConfig {
  fb_pixel_id?: string | null;
  tiktok_pixel_id?: string | null;
  google_ads_id?: string | null;
  google_ads_label?: string | null;
  gtm_id?: string | null;
}

interface PixelInjectorProps {
  pixels: PixelConfig;
  event: "view" | "purchase";
  /** Required when event === "purchase" */
  value?: number;
  currency?: string;
  orderId?: string;
  productName?: string;
}

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    ttq?: any;
    dataLayer?: any[];
    gtag?: (...args: any[]) => void;
  }
}

function injectScript(id: string, src: string, inline?: string) {
  if (document.getElementById(id)) return;
  if (inline) {
    const s = document.createElement("script");
    s.id = id;
    s.innerHTML = inline;
    document.head.appendChild(s);
  } else {
    const s = document.createElement("script");
    s.id = id;
    s.async = true;
    s.src = src;
    document.head.appendChild(s);
  }
}

// ── Meta (Facebook) Pixel ─────────────────────────────────────────────────────
function initFbPixel(pixelId: string) {
  if (window.fbq) return;
  injectScript(
    `fb-pixel-${pixelId}`,
    "",
    `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${pixelId}');fbq('track','PageView');`
  );
}

// ── TikTok Pixel ──────────────────────────────────────────────────────────────
function initTikTokPixel(pixelId: string) {
  if (window.ttq) return;
  injectScript(
    `tiktok-pixel-${pixelId}`,
    "",
    `!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready",
"alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)
ttq.setAndDefer(e,ttq.methods[n]);return e};
ttq.load=function(e,n){var i="https://analytics.tiktok.com/i18n/pixel/events.js";
ttq._i=ttq._i||{};ttq._i[e]=[];ttq._i[e]._u=i;ttq._t=ttq._t||{};ttq._t[e]=+new Date;
ttq._o=ttq._o||{};ttq._o[e]=n||{};var o=document.createElement("script");
o.type="text/javascript";o.async=!0;o.src=i+"?sdkid="+e+"&lib="+t;
var a=document.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('${pixelId}');ttq.page();}(window,document,'ttq');`
  );
}

// ── Google Ads / gtag ─────────────────────────────────────────────────────────
function initGoogleAds(adsId: string) {
  if (!document.getElementById(`gtag-base-${adsId}`)) {
    injectScript(
      `gtag-base-${adsId}`,
      `https://www.googletagmanager.com/gtag/js?id=${adsId}`
    );
    injectScript(
      `gtag-init-${adsId}`,
      "",
      `window.dataLayer=window.dataLayer||[];
function gtag(){dataLayer.push(arguments);}
gtag('js',new Date());gtag('config','${adsId}');`
    );
  }
}

// ── GTM ───────────────────────────────────────────────────────────────────────
function initGTM(gtmId: string) {
  if (document.getElementById(`gtm-${gtmId}`)) return;
  injectScript(
    `gtm-${gtmId}`,
    "",
    `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtmId}');`
  );
  // GTM noscript iframe
  if (!document.getElementById(`gtm-noscript-${gtmId}`)) {
    const ns = document.createElement("noscript");
    ns.id = `gtm-noscript-${gtmId}`;
    ns.innerHTML = `<iframe src="https://www.googletagmanager.com/ns.html?id=${gtmId}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`;
    document.body?.prepend(ns);
  }
}

// ── Event Firing ──────────────────────────────────────────────────────────────
function fireViewEvent(pixels: PixelConfig, productName?: string) {
  if (pixels.fb_pixel_id && window.fbq) {
    window.fbq("track", "ViewContent", {
      content_name: productName || "Checkout",
      content_type: "product",
    });
  }
  if (pixels.tiktok_pixel_id && window.ttq) {
    window.ttq.track("ViewContent", {
      content_name: productName || "Checkout",
      content_type: "product",
    });
  }
  if (pixels.google_ads_id && window.gtag) {
    window.gtag("event", "page_view");
  }
  if (pixels.gtm_id && window.dataLayer) {
    window.dataLayer.push({ event: "view_content", content_name: productName });
  }
}

function firePurchaseEvent(
  pixels: PixelConfig,
  value: number,
  currency: string,
  orderId?: string,
  productName?: string
) {
  if (pixels.fb_pixel_id && window.fbq) {
    window.fbq("track", "Purchase", {
      value,
      currency: currency.toUpperCase(),
      content_name: productName,
      order_id: orderId,
    });
  }
  if (pixels.tiktok_pixel_id && window.ttq) {
    window.ttq.track("CompletePayment", {
      value,
      currency: currency.toUpperCase(),
      content_id: orderId,
      content_name: productName,
      content_type: "product",
    });
  }
  if (pixels.google_ads_id && pixels.google_ads_label && window.gtag) {
    window.gtag("event", "conversion", {
      send_to: `${pixels.google_ads_id}/${pixels.google_ads_label}`,
      value,
      currency: currency.toUpperCase(),
      transaction_id: orderId,
    });
  }
  if (pixels.gtm_id && window.dataLayer) {
    window.dataLayer.push({
      event: "purchase",
      ecommerce: {
        transaction_id: orderId,
        value,
        currency: currency.toUpperCase(),
        items: [{ item_name: productName }],
      },
    });
  }
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function PixelInjector({
  pixels,
  event,
  value = 0,
  currency = "BRL",
  orderId,
  productName,
}: PixelInjectorProps) {
  useEffect(() => {
    const { fb_pixel_id, tiktok_pixel_id, google_ads_id, google_ads_label, gtm_id } = pixels;
    if (!fb_pixel_id && !tiktok_pixel_id && !google_ads_id && !gtm_id) return;

    // Initialise all configured pixels
    if (fb_pixel_id) initFbPixel(fb_pixel_id);
    if (tiktok_pixel_id) initTikTokPixel(tiktok_pixel_id);
    if (google_ads_id) initGoogleAds(google_ads_id);
    if (gtm_id) initGTM(gtm_id);

    // Small delay to ensure scripts are ready before firing events
    const timeout = setTimeout(() => {
      if (event === "view") {
        fireViewEvent(pixels, productName);
      } else if (event === "purchase") {
        firePurchaseEvent(pixels, value, currency, orderId, productName);
      }
    }, 500);

    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
