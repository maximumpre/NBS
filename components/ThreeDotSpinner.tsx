/**
 * Three-dot bounce spinner — WealthCare loading indicator.
 *
 * Reproduction of the WealthCare / Aptia / Alegeus `authentication-confirmation`
 * component's `<load-status>` element:
 *
 *   <div class="loading-box"><span class="spinner"><span></span> <span></span> <span></span></span></div>
 *
 * The reference implements this **entirely in CSS** (keyframes `sk-bouncedelay`).
 * There is no image, GIF, Lottie, sprite or video behind it, so there is nothing
 * to download — see `components/three-dot-spinner.css`.
 *
 * Measured on the live reference at 1440px: three `#ccc` circles ~22px diameter,
 * ~35px apart, horizontally centred in the content column.
 *
 * Usage: render in place of the form region while a gate request is in flight.
 * The copy above and the cancel note below stay on screen.
 */
export function ThreeDotSpinner({ label = "Loading" }: { label?: string }) {
  return (
    <div className="wcp-loading-box" role="status" aria-live="polite" aria-label={label}>
      <span className="wcp-spinner" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
    </div>
  )
}
