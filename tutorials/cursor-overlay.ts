export function overlays() {
  window.addEventListener('DOMContentLoaded', () => {
    const cursor = document.createElement('div');
    const ripple = document.createElement('div');
    cursor.style.cssText = 'position:fixed;top:-48px;left:-48px;z-index:2147483647;pointer-events:none;filter:drop-shadow(0 1px 3px black)';
    cursor.innerHTML = '<svg width="31" height="39" viewBox="0 0 31 39"><path d="M3 3v29l8-7 5 11 5-3-5-11h11z" fill="#fff" stroke="#101722" stroke-width="2.4" stroke-linejoin="round"/></svg>';
    ripple.style.cssText = 'position:fixed;top:-60px;left:-60px;width:28px;height:28px;border:3px solid #eab35b;border-radius:50%;z-index:2147483646;pointer-events:none;opacity:0';
    document.documentElement.append(ripple, cursor);
    window.addEventListener('mousemove', event => {
      cursor.style.left = (event.clientX - 3) + 'px';
      cursor.style.top = (event.clientY - 3) + 'px';
    }, true);
    window.addEventListener('pointerdown', event => {
      ripple.style.left = event.clientX + 'px';
      ripple.style.top = event.clientY + 'px';
      ripple.getAnimations().forEach(animation => animation.cancel());
      ripple.animate([
        { opacity: 1, transform: 'translate(-50%, -50%) scale(.65)' },
        { opacity: 0, transform: 'translate(-50%, -50%) scale(2.4)' }
      ], { duration: 650, easing: 'ease-out' });
    }, true);
  });
}
