<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import heroImage from './assets/hero.png'

type AvailabilityStatus = 'available' | 'limited' | 'blocked'

type AvailabilityDay = {
  status: AvailabilityStatus
  slots: string[]
  note?: string
}

const today = new Date()
today.setHours(0, 0, 0, 0)

const monthCursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selectedDate = ref('')
const selectedSlot = ref('')
const submittedPayload = ref('')

const form = reactive({
  name: '',
  email: '',
  phone: '',
  street: '',
  unit: '',
  city: '',
  state: '',
  zip: '',
  guests: 12,
  occasion: 'Birthday party',
  vibe: 'Loud, competitive, and celebratory',
  customVibe: '',
  notes: '',
})

const formatDateKey = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date: Date, days: number) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const availability: Record<string, AvailabilityDay> = {
  [formatDateKey(addDays(today, 3))]: {
    status: 'limited',
    slots: ['6:30 PM'],
    note: 'One host left',
  },
  [formatDateKey(addDays(today, 5))]: {
    status: 'available',
    slots: ['2:00 PM', '5:00 PM', '8:00 PM'],
  },
  [formatDateKey(addDays(today, 7))]: {
    status: 'blocked',
    slots: [],
    note: 'Already booked',
  },
  [formatDateKey(addDays(today, 10))]: {
    status: 'available',
    slots: ['4:00 PM', '7:30 PM'],
  },
  [formatDateKey(addDays(today, 14))]: {
    status: 'limited',
    slots: ['3:00 PM'],
    note: 'Travel window',
  },
  [formatDateKey(addDays(today, 18))]: {
    status: 'available',
    slots: ['1:00 PM', '6:00 PM'],
  },
}

const fallbackSlots = ['2:00 PM', '5:30 PM', '8:00 PM']
const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthCursor.value),
)

const calendarDays = computed(() => {
  const firstDay = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index)
    const key = formatDateKey(date)
    const managed = availability[key]
    const isPast = date < today
    const isOutsideMonth = date.getMonth() !== monthCursor.value.getMonth()
    const status: AvailabilityStatus = isPast
      ? 'blocked'
      : managed?.status ?? (date.getDay() === 0 ? 'limited' : 'available')

    return {
      date,
      key,
      label: date.getDate(),
      isOutsideMonth,
      isSelected: key === selectedDate.value,
      status,
      slots: managed?.slots ?? (status === 'blocked' ? [] : fallbackSlots),
      note: managed?.note,
    }
  })
})

const selectedAvailability = computed(() =>
  calendarDays.value.find((day) => day.key === selectedDate.value),
)

const selectedReadableDate = computed(() => {
  if (!selectedDate.value) return 'Choose a date'
  const [year, month, day] = selectedDate.value.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
})

const canSubmit = computed(
  () =>
    form.name &&
    form.email &&
    form.street &&
    form.city &&
    form.state &&
    form.zip &&
    selectedDate.value &&
    selectedSlot.value,
)

const shiftMonth = (amount: number) => {
  monthCursor.value = new Date(
    monthCursor.value.getFullYear(),
    monthCursor.value.getMonth() + amount,
    1,
  )
}

const selectDay = (day: { key: string; status: AvailabilityStatus; slots: string[] }) => {
  if (day.status === 'blocked') return
  selectedDate.value = day.key
  selectedSlot.value = day.slots[0] ?? ''
}

const submitRequest = () => {
  if (!canSubmit.value) return

  const payload = {
    service: 'In-home Jeopardy concierge',
    price: 350,
    contact: {
      name: form.name,
      email: form.email,
      phone: form.phone,
    },
    address: {
      street: form.street,
      unit: form.unit,
      city: form.city,
      state: form.state,
      zip: form.zip,
    },
    event: {
      date: selectedDate.value,
      time: selectedSlot.value,
      guests: form.guests,
      occasion: form.occasion,
      vibe: form.customVibe || form.vibe,
      notes: form.notes,
    },
  }

  submittedPayload.value = JSON.stringify(payload, null, 2)
}
</script>

<template>
  <main class="site-shell">
    <section class="hero-section" aria-labelledby="hero-title">
      <nav class="topbar" aria-label="Primary navigation">
        <a class="brand" href="#top" aria-label="Daily Double Concierge home">
          <span>805 Game Show</span>
        </a>
        <div class="nav-actions">
          <a href="#service">Details</a>
          <a href="#booking">Book Now</a>
          <a class="nav-button" href="#booking">Starting at $350</a>
        </div>
      </nav>

      <div class="hero-grid" id="top">
        <div class="hero-copy">
          <p class="eyebrow">A bolts and bits production</p>
          <h1 id="hero-title">A studio production, all in your living room.</h1>
          <p class="hero-lede">
            We'll bring the host, board, podiums, and buzzers. You focus on winning.
          </p>
          <div class="hero-actions">
            <a class="primary-action" href="#booking">Reserve a date</a>
            <a class="secondary-action" href="#service">See what is included</a>
          </div>
        </div>

        <aside class="hero-board" aria-label="Service highlights">
          <img :src="heroImage" alt="" />
          <div class="price-panel">
            <span class="price-kicker">House call package</span>
            <strong>$350</strong>
            <span>2-hour hosted game, setup included</span>
          </div>
        </aside>
      </div>
    </section>

    <section class="section-band proof-band" aria-label="Quick service stats">
      <div>
        <strong>X minutes</strong>
        <span>Typical playtime</span>
      </div>
      <div>
        <strong>3-10</strong>
        <span>Recommended Party Size</span>
      </div>
      <div>
        <strong>Custom</strong>
        <span>Categories available</span>
      </div>
      <div>
        <strong>No stress</strong>
        <span>We run the whole room</span>
      </div>
    </section>

    <section class="content-section" id="service">
      <div class="section-heading">
        <p class="eyebrow">What arrives at your door</p>
        <h2>Everything needed for a polished game night.</h2>
      </div>
      <div class="feature-grid">
        <article>
          <span class="feature-icon">01</span>
          <h3>Host and game flow</h3>
          <p>
           Our experienced host runs the night with energy, humor, and command of the room.
        
          </p>
        </article>
        <article>
          <span class="feature-icon">02</span>
          <h3>Board, buzzers, and podiums</h3>
          <p>
            Our custom-built hardware and software can accomodate any location and group.
          </p>
        </article>
        <article>
          <span class="feature-icon">03</span>
          <h3>Tailored categories</h3>
          <p>
            Have your pick of over Y categories, or we'll work with you to create custom ones based on your group's interests*.
          </p>
        </article>
      </div>
    </section>

    <section class="booking-section" id="booking" aria-labelledby="booking-title">
      <div class="booking-intro">
        <p class="eyebrow">Booking Details</p>
        <h2 id="booking-title">Pick a date and tell us a bit about the party</h2>
        <p>
          Fill out an interest form and our team will respond within 24 hours to confirm. Please note that we recommend at least two weeks notice for any custom requests.
        </p>
      </div>

      <div class="booking-layout">
        <form class="booking-form" @submit.prevent="submitRequest">
          <fieldset>
            <legend>Contact</legend>
            <label>
              Name
              <input v-model="form.name" autocomplete="name" required placeholder="Placeholder Name" />
            </label>
            <label>
              Email
              <input
                v-model="form.email"
                autocomplete="email"
                type="email"
                required
                placeholder="you@example.com"
              />
            </label>
            <label>
              Phone
              <input v-model="form.phone" autocomplete="tel" type="tel" placeholder="(555) 555-0123" />
            </label>
          </fieldset>

          <fieldset>
            <legend>House address</legend>
            <label class="wide">
              Street address
              <input v-model="form.street" autocomplete="street-address" required placeholder="123 Placeholder Ave" />
            </label>
            <label>
              Apt, suite, gate code
              <input v-model="form.unit" placeholder="Unit 4B" />
            </label>
            <label>
              City
              <input v-model="form.city" autocomplete="address-level2" required placeholder="Los Angeles" />
            </label>
            <label>
              State
              <input v-model="form.state" autocomplete="address-level1" maxlength="2" required placeholder="CA" />
            </label>
            <label>
              ZIP
              <input v-model="form.zip" autocomplete="postal-code" inputmode="numeric" required placeholder="90026" />
            </label>
          </fieldset>

          <fieldset>
            <legend>Group vibe</legend>
            <label>
              Guests
              <input v-model.number="form.guests" min="4" max="60" type="number" />
            </label>
            <label>
              Occasion
              <select v-model="form.occasion">
                <option>Birthday party</option>
                <option>Office offsite</option>
                <option>Dinner party</option>
                <option>Family reunion</option>
                <option>Fundraiser</option>
              </select>
            </label>
            <label class="wide">
              Vibe
              <select v-model="form.vibe">
                <option>Loud, competitive, and celebratory</option>
                <option>Smart, relaxed, and dinner-party polished</option>
                <option>Corporate-friendly with inside jokes</option>
                <option>Family-friendly with mixed ages</option>
              </select>
            </label>
            <label class="wide">
              Custom vibe notes
              <textarea
                v-model="form.customVibe"
                rows="3"
                placeholder="Placeholder: half trivia nerds, half first-timers, lots of 90s movies..."
              />
            </label>
            <label class="wide">
              Access, parking, or setup notes
              <textarea
                v-model="form.notes"
                rows="3"
                placeholder="Placeholder: easy driveway parking, 65-inch TV available, elevator code..."
              />
            </label>
          </fieldset>

          <button class="submit-button" type="submit" :disabled="!canSubmit">Request booking</button>
        </form>

        <aside class="calendar-panel" aria-label="Date picker">
          <div class="calendar-toolbar">
            <button type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
            <strong>{{ monthLabel }}</strong>
            <button type="button" aria-label="Next month" @click="shiftMonth(1)">›</button>
          </div>

          <div class="weekday-row" aria-hidden="true">
            <span v-for="day in weekdays" :key="day">{{ day }}</span>
          </div>

          <div class="calendar-grid">
            <button
              v-for="day in calendarDays"
              :key="day.key"
              type="button"
              class="calendar-day"
              :class="[day.status, { outside: day.isOutsideMonth, selected: day.isSelected }]"
              :disabled="day.status === 'blocked'"
              @click="selectDay(day)"
            >
              <span>{{ day.label }}</span>
              <small>{{ day.status === 'blocked' ? 'Full' : day.status === 'limited' ? 'Few' : 'Open' }}</small>
            </button>
          </div>

          <div class="slot-panel">
            <p class="selected-date">{{ selectedReadableDate }}</p>
            <div v-if="selectedAvailability?.slots.length" class="slot-grid">
              <button
                v-for="slot in selectedAvailability.slots"
                :key="slot"
                type="button"
                :class="{ selected: selectedSlot === slot }"
                @click="selectedSlot = slot"
              >
                {{ slot }}
              </button>
            </div>
            <p v-else class="calendar-help">Select an open date to see arrival windows.</p>
          </div>

          <div class="booking-summary">
            <span>Estimated total</span>
            <strong>$350</strong>
            <p>Flat-rate in-home hosting. Payment handling can be attached after request approval.</p>
          </div>

          <pre v-if="submittedPayload" class="payload-preview">{{ submittedPayload }}</pre>
        </aside>
      </div>
    </section>
  </main>
</template>
