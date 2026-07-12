<script setup lang="ts">
import { computed, ref } from 'vue'

// Replace these two values with the real Peril! booking details before launch.
const bookingEmail = 'bookings@playperil.com'
const bookingPhone = '(805) 555-0147'
const bookingPhoneHref = '+18055550147'

const menuOpen = ref(false)
const year = new Date().getFullYear()

const emailHref = computed(() => {
  const subject = encodeURIComponent('I want to book Peril!')
  const body = encodeURIComponent(
    'Hi Peril! team,\n\nI’m interested in booking a game.\n\nEvent date:\nLocation:\nNumber of players:\nBest way to reach me:\n\nThanks!',
  )
  return `mailto:${bookingEmail}?subject=${subject}&body=${body}`
})

const closeMenu = () => {
  menuOpen.value = false
}
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <a class="logo" href="#top" aria-label="Peril home" @click="closeMenu">
        <span class="logo-bolt">P</span>
        <span>PERIL!</span>
      </a>

      <button
        class="menu-toggle"
        type="button"
        :aria-expanded="menuOpen"
        aria-label="Toggle navigation"
        @click="menuOpen = !menuOpen"
      >
        <span></span><span></span>
      </button>

      <nav :class="['nav-links', { open: menuOpen }]" aria-label="Main navigation">
        <a href="#how-it-works" @click="closeMenu">How it works</a>
        <a href="#occasions" @click="closeMenu">Perfect for</a>
        <a href="#contact" @click="closeMenu">Contact</a>
        <a class="nav-cta" :href="emailHref">Book your game <span>↗</span></a>
      </nav>
    </header>

    <main id="top">
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow"><span></span> Santa Barbara’s live trivia game</p>
          <h1>YOUR CREW.<br />YOUR GAME.<br /><em>REAL PERIL.</em></h1>
          <p class="hero-lede">
            The answer is: the most fun you’ll have all night. We bring the buzzers, the board,
            and the big game-show energy to your event anywhere in Santa Barbara.
          </p>
          <div class="hero-actions">
            <a class="button button-primary" :href="emailHref">Book by email <span>↗</span></a>
            <a class="button button-ghost" :href="`tel:${bookingPhoneHref}`">Call {{ bookingPhone }}</a>
          </div>
        </div>

        <div class="hero-stage" aria-label="Peril game board graphic">
          <div class="spotlight"></div>
          <div class="game-board">
            <div v-for="category in ['LOCAL', 'MOVIES', 'WILD CARD']" :key="category" class="board-column">
              <strong>{{ category }}</strong>
              <span>200</span><span>400</span><span>600</span>
            </div>
          </div>
          <div class="podium podium-one"><b>1</b><span>TEAM A</span></div>
          <div class="podium podium-two"><b>2</b><span>TEAM B</span></div>
          <div class="host-card"><span>LIVE</span><strong>PERIL!</strong><small>SANTA BARBARA</small></div>
        </div>
      </section>

      <section class="ticker" aria-label="Service highlights">
        <div>WE HOST <i>✦</i> YOU PLAY <i>✦</i> BUZZERS INCLUDED <i>✦</i> CUSTOM QUESTIONS <i>✦</i> BIG GAME ENERGY <i>✦</i></div>
      </section>

      <section id="how-it-works" class="section how-section">
        <div class="section-kicker">01 / How it works</div>
        <div class="section-heading">
          <h2>WE TURN YOUR<br />ROOM INTO A <em>STUDIO.</em></h2>
          <p>No stress, no setup, no awkward trivia app. Just a fast, hosted game built around your people.</p>
        </div>

        <div class="steps-grid">
          <article>
            <span class="step-number">01</span>
            <div class="step-icon">⌁</div>
            <h3>Pick the occasion</h3>
            <p>Tell us when, where, and who’s playing. We travel throughout Santa Barbara.</p>
          </article>
          <article>
            <span class="step-number">02</span>
            <div class="step-icon">?</div>
            <h3>We build the game</h3>
            <p>Classic trivia meets custom clues about your group, event, or favorite subjects.</p>
          </article>
          <article>
            <span class="step-number">03</span>
            <div class="step-icon">⚡</div>
            <h3>Game time</h3>
            <p>We arrive with the gear and host the show. You grab a buzzer and chase the win.</p>
          </article>
        </div>
      </section>

      <section id="occasions" class="occasions-section">
        <div class="occasions-copy">
          <div class="section-kicker">02 / Your night, upgraded</div>
          <h2>ANY CROWD.<br />ONE <em>GREAT GAME.</em></h2>
          <p>Peril! flexes to fit your room—from a dozen friends around a table to a full company showdown.</p>
          <ul>
            <li><span>01</span> Birthdays & celebrations</li>
            <li><span>02</span> Company parties & team building</li>
            <li><span>03</span> Weddings & rehearsal dinners</li>
            <li><span>04</span> Bars, restaurants & community nights</li>
          </ul>
        </div>
        <div class="quote-card">
          <div class="quote-mark">“</div>
          <blockquote>The kind of night people keep talking about.</blockquote>
          <p>Fast questions. Friendly rivalry. Zero boring small talk.</p>
          <div class="score-strip"><span>FUN</span><b>1000</b></div>
        </div>
      </section>

      <section id="contact" class="contact-section">
        <p class="eyebrow"><span></span> Ready to play?</p>
        <h2>LET’S MAKE IT<br /><em>GAME NIGHT.</em></h2>
        <p class="contact-lede">Send us your date, location, and group size. We’ll get back to you with availability and a simple quote.</p>
        <div class="contact-options">
          <a :href="emailHref">
            <small>Email us</small>
            <strong>{{ bookingEmail }}</strong>
            <span>↗</span>
          </a>
          <a :href="`tel:${bookingPhoneHref}`">
            <small>Call us</small>
            <strong>{{ bookingPhone }}</strong>
            <span>↗</span>
          </a>
        </div>
        <p class="service-area">Available for events throughout Santa Barbara, Goleta, Montecito, and nearby communities.</p>
      </section>
    </main>

    <footer>
      <a class="logo" href="#top"><span class="logo-bolt">P</span><span>PERIL!</span></a>
      <p>© {{ year }} Peril! Santa Barbara. Not affiliated with Jeopardy! or Sony Pictures Television.</p>
      <a href="#top">Back to top ↑</a>
    </footer>
  </div>
</template>
