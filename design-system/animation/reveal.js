// 스크롤로 나타나기(.ds-reveal, data-motion, data-count-to) 요소가 화면에 들어오면 is-visible을 붙여 주는 작은 스크립트
(function () {
  // JS가 실행될 때만 숨김 규칙이 적용되도록 표시한다 (JS가 없으면 내용이 그대로 보인다)
  document.documentElement.classList.add('ds-js')

  var SELECTOR = '.ds-reveal, [data-motion], [data-count-to]'
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches

  // 숫자를 0에서 data-count-to 값까지 올린다(900ms, 끝이 천천히 가라앉는 곡선). 소수 자릿수는 목표값을 따른다
  function format(el, n) {
    var dec = (el.getAttribute('data-count-to').split('.')[1] || '').length
    return n.toLocaleString('ko-KR', { minimumFractionDigits: dec, maximumFractionDigits: dec })
  }
  function countUp(el) {
    var to = parseFloat(el.getAttribute('data-count-to'))
    if (isNaN(to)) return
    var t0 = null
    function frame(t) {
      if (t0 === null) t0 = t
      var k = Math.min((t - t0) / 900, 1)
      el.textContent = format(el, to * (1 - Math.pow(1 - k, 4)))
      if (k < 1) requestAnimationFrame(frame)
    }
    requestAnimationFrame(frame)
  }

  function show(el) {
    el.classList.add('is-visible')
    if (!el.hasAttribute('data-count-to')) return
    if (reduce) el.textContent = format(el, parseFloat(el.getAttribute('data-count-to')))
    else countUp(el)
  }

  // data-motion-stagger="100"인 부모는 자식 data-motion에 차례로 지연을 준다. data-motion-delay="300"은 그 요소만 지연
  function applyDelays() {
    document.querySelectorAll('[data-motion-stagger]').forEach(function (parent) {
      var step = parseInt(parent.getAttribute('data-motion-stagger'), 10) || 100
      parent.querySelectorAll('[data-motion]').forEach(function (el, i) { el.style.setProperty('--ds-delay', i * step + 'ms') })
    })
    document.querySelectorAll('[data-motion-delay]').forEach(function (el) {
      el.style.setProperty('--ds-delay', parseInt(el.getAttribute('data-motion-delay'), 10) + 'ms')
    })
  }

  // 미리보기·테스트용. root 안의 요소를 숨김으로 되돌린 뒤 다시 재생한다(전환을 끄고 리셋해야 되돌아가는 전환과 섞이지 않는다)
  window.dsReplay = function (root) {
    var items = Array.prototype.slice.call(root.querySelectorAll(SELECTOR))
    if (root.matches(SELECTOR)) items.unshift(root)
    items.forEach(function (el) {
      el.style.transition = 'none'
      el.classList.remove('is-visible')
      if (el.hasAttribute('data-count-to')) el.textContent = format(el, 0)
    })
    void root.offsetWidth
    items.forEach(function (el) { el.style.transition = '' })
    requestAnimationFrame(function () { items.forEach(show) })
  }

  // data-motion="words"인 요소의 글을 단어마다 <span style="--i:순서">로 쪼갠다(순서대로 나타나는 CSS가 --i를 쓴다)
  function splitWords(el) {
    var words = el.textContent.trim().split(/\s+/)
    el.textContent = ''
    words.forEach(function (w, i) {
      var span = document.createElement('span')
      span.style.setProperty('--i', i)
      span.textContent = w
      if (i) el.appendChild(document.createTextNode(' '))
      el.appendChild(span)
    })
  }

  // data-motion="chars"인 요소의 글을 글자마다 <span class="ds-fx-c" style="--i:순서">로 쪼갠다. 단어 중간에서 줄이 바뀌지 않게 단어는 한 묶음으로 둔다.
  // 글자가 따로 읽히지 않도록 원문을 aria-label로 두고 쪼갠 조각은 스크린리더에서 숨긴다
  function splitChars(el) {
    var text = el.textContent.trim()
    var n = 0
    el.setAttribute('aria-label', text)
    el.textContent = ''
    text.split(/\s+/).forEach(function (word, wi) {
      var wrap = document.createElement('span')
      wrap.setAttribute('aria-hidden', 'true')
      Array.prototype.forEach.call(word, function (ch) {
        var c = document.createElement('span')
        c.className = 'ds-fx-c'
        c.style.setProperty('--i', n++)
        c.textContent = ch
        wrap.appendChild(c)
      })
      if (wi) el.appendChild(document.createTextNode(' '))
      el.appendChild(wrap)
    })
  }

  function start() {
    var items = document.querySelectorAll(SELECTOR)
    applyDelays()
    // 움직임 줄이기 설정이거나 IntersectionObserver를 쓸 수 없으면 바로 모두 보여 준다(숫자는 처음부터 목표값)
    if (reduce || !('IntersectionObserver' in window)) {
      items.forEach(function (el) { el.classList.add('is-visible') })
      return
    }
    items.forEach(function (el) {
      if (el.hasAttribute('data-count-to')) el.textContent = format(el, 0)
    })
    document.querySelectorAll('[data-motion="words"]').forEach(splitWords)
    document.querySelectorAll('[data-motion="chars"]').forEach(splitChars)
    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return
          show(entry.target)
          observer.unobserve(entry.target) // 한 번 나타나면 다시 숨기지 않는다
        })
      },
      { threshold: 0.12, rootMargin: '0px 0px -5% 0px' },
    )
    items.forEach(function (el) { observer.observe(el) })
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
  else start()
})()
