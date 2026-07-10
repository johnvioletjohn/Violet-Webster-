/**
 * Full-viewport drag + wheel scrolling for the horizontal CV.
 */
(function () {
  var scroller = document.querySelector('.page-scroll');
  if (!scroller) return;

  var dragging = false;
  var moved = false;
  var startX = 0;
  var startScroll = 0;
  var DRAG_THRESHOLD = 6;

  function isInteractive(target) {
    if (!target || !target.closest) return false;
    return !!target.closest('a, button, input, textarea, select');
  }

  scroller.addEventListener(
    'wheel',
    function (e) {
      // Turn vertical wheel / trackpad into horizontal scroll anywhere on the page.
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        scroller.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false }
  );

  scroller.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startScroll = scroller.scrollLeft;
    scroller.setPointerCapture(e.pointerId);
  });

  scroller.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > DRAG_THRESHOLD) {
      moved = true;
      document.body.classList.add('is-dragging');
    }
    if (moved) {
      scroller.scrollLeft = startScroll - dx;
      e.preventDefault();
    }
  });

  function endDrag(e) {
    if (!dragging) return;
    dragging = false;
    document.body.classList.remove('is-dragging');
    try {
      scroller.releasePointerCapture(e.pointerId);
    } catch (err) {}
  }

  scroller.addEventListener('pointerup', endDrag);
  scroller.addEventListener('pointercancel', endDrag);

  // If the user dragged, don't fire link clicks / snapshot clicks.
  document.addEventListener(
    'click',
    function (e) {
      if (!moved) return;
      e.preventDefault();
      e.stopPropagation();
      moved = false;
    },
    true
  );
})();
