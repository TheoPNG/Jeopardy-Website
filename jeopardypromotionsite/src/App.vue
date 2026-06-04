<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import heroImage from './assets/hero.png'

type AvailabilityStatus = 'available' | 'limited' | 'blocked'

type AvailabilityDay = {
  date?: string
  status: AvailabilityStatus
  slots: string[]
  note?: string
}

type AvailabilityConfig = {
  defaultSlots: string[]
  blockedWeekdays: number[]
  overrides: Record<string, AvailabilityDay>
}

type Booking = {
  id: string
  createdAt: string
  updatedAt?: string
  status: string
  service: string
  price: number
  contact: {
    name: string
    email: string
    phone?: string
  }
  address: {
    street: string
    unit?: string
    city: string
    state: string
    zip: string
  }
  event: {
    date: string
    time: string
    guests: number
    occasion: string
    vibe: string
    notes?: string
  }
}

const today = new Date()
today.setHours(0, 0, 0, 0)

const isAdminView = ref(window.location.pathname.startsWith('/admin'))
const monthCursor = ref(new Date(today.getFullYear(), today.getMonth(), 1))
const selectedDate = ref('')
const bookingId = ref('')
const submitError = ref('')
const isSubmitting = ref(false)
const isLoadingAvailability = ref(false)
const availability = ref<Record<string, AvailabilityDay>>({})

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
  requestedTime: '',
  occasion: 'Birthday party',
  vibe: 'Loud, competitive, and celebratory',
  customVibe: '',
  notes: '',
})

const adminToken = ref(localStorage.getItem('jeopardyAdminToken') || '')
const adminPassword = ref('')
const adminError = ref('')
const adminMessage = ref('')
const adminBookings = ref<Booking[]>([])
const adminConfig = reactive<AvailabilityConfig>({
  defaultSlots: [],
  blockedWeekdays: [],
  overrides: {},
})
const defaultSlotsText = ref('')
const overrideDate = ref('')
const overrideStatus = ref<AvailabilityStatus>('available')
const overrideNote = ref('')

const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const requestedTimeOptions = [
  '10:00 AM',
  '11:00 AM',
  '12:00 PM',
  '1:00 PM',
  '2:00 PM',
  '3:00 PM',
  '4:00 PM',
  '5:00 PM',
  '6:00 PM',
  '7:00 PM',
  '8:00 PM',
  '9:00 PM',
  '10:00 PM',
]
const weekdayChoices = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
]

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

const splitSlots = (value: string) =>
  value
    .split(/[\n,]/)
    .map((slot) => slot.trim())
    .filter(Boolean)

const readableDate = (date: string) => {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(year, month - 1, day))
}

const monthLabel = computed(() =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(monthCursor.value),
)

const currentMonthKey = computed(() => {
  const year = monthCursor.value.getFullYear()
  const month = String(monthCursor.value.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
})

const calendarDays = computed(() => {
  const firstDay = new Date(monthCursor.value.getFullYear(), monthCursor.value.getMonth(), 1)
  const start = new Date(firstDay)
  start.setDate(firstDay.getDate() - firstDay.getDay())

  return Array.from({ length: 42 }, (_, index) => {
    const date = addDays(start, index)
    const key = formatDateKey(date)
    const managed = availability.value[key]
    const isPast = date < today
    const status: AvailabilityStatus = isPast ? 'blocked' : managed?.status ?? 'blocked'

    return {
      key,
      label: date.getDate(),
      isOutsideMonth: date.getMonth() !== monthCursor.value.getMonth(),
      isSelected: key === selectedDate.value,
      status,
      slots: managed?.slots ?? [],
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
    !isSubmitting.value &&
    form.name &&
    form.email &&
    form.street &&
    form.city &&
    form.state &&
    form.zip &&
    selectedDate.value &&
    form.requestedTime,
)

const sortedOverrides = computed(() =>
  Object.entries(adminConfig.overrides)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, rule]) => ({ date, ...rule })),
)

const fetchAvailability = async () => {
  isLoadingAvailability.value = true
  submitError.value = ''

  try {
    const response = await fetch(`/api/availability?month=${currentMonthKey.value}`)
    if (!response.ok) throw new Error('Availability could not be loaded.')

    const data = (await response.json()) as { days: AvailabilityDay[] }
    availability.value = data.days.reduce<Record<string, AvailabilityDay>>((calendar, day) => {
      if (!day.date) return calendar
      calendar[day.date] = {
        status: day.status,
        slots: day.slots,
        note: day.note,
      }
      return calendar
    }, {})

    const current = selectedDate.value ? availability.value[selectedDate.value] : undefined
    if (!current || current.status === 'blocked') {
      selectedDate.value = ''
    }
  } catch (error) {
    submitError.value =
      error instanceof Error ? error.message : 'Availability could not be loaded.'
  } finally {
    isLoadingAvailability.value = false
  }
}

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
  bookingId.value = ''
}

const buildPayload = () => ({
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
    time: form.requestedTime,
    guests: form.guests,
    occasion: form.occasion,
    vibe: form.customVibe || form.vibe,
    notes: form.notes,
  },
})

const submitRequest = async () => {
  if (!canSubmit.value) return

  isSubmitting.value = true
  submitError.value = ''
  bookingId.value = ''

  try {
    const response = await fetch('/api/bookings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildPayload()),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Booking request failed.')

    bookingId.value = data.bookingId
    await fetchAvailability()
  } catch (error) {
    submitError.value = error instanceof Error ? error.message : 'Booking request failed.'
  } finally {
    isSubmitting.value = false
  }
}

const adminFetch = async (url: string, options: RequestInit = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${adminToken.value}`,
    },
  })
  const data = await response.json()
  if (!response.ok) throw new Error(data.message || 'Admin request failed.')
  return data
}

const loadAdminData = async () => {
  if (!adminToken.value) return
  adminError.value = ''

  try {
    const [bookingsData, configData] = await Promise.all([
      adminFetch('/api/admin/bookings'),
      adminFetch('/api/admin/availability'),
    ])

    adminBookings.value = bookingsData.bookings
    adminConfig.defaultSlots = configData.defaultSlots
    adminConfig.blockedWeekdays = configData.blockedWeekdays
    adminConfig.overrides = configData.overrides
    defaultSlotsText.value = configData.defaultSlots.join(', ')
  } catch (error) {
    adminToken.value = ''
    localStorage.removeItem('jeopardyAdminToken')
    adminError.value = error instanceof Error ? error.message : 'Admin data could not be loaded.'
  }
}

const loginAdmin = async () => {
  adminError.value = ''
  adminMessage.value = ''

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: adminPassword.value }),
    })
    const data = await response.json()
    if (!response.ok) throw new Error(data.message || 'Login failed.')

    adminToken.value = data.token
    localStorage.setItem('jeopardyAdminToken', data.token)
    adminPassword.value = ''
    await loadAdminData()
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : 'Login failed.'
  }
}

const logoutAdmin = () => {
  adminToken.value = ''
  localStorage.removeItem('jeopardyAdminToken')
}

const saveAvailability = async () => {
  adminError.value = ''
  adminMessage.value = ''

  try {
    const nextConfig = {
      defaultSlots: splitSlots(defaultSlotsText.value),
      blockedWeekdays: adminConfig.blockedWeekdays,
      overrides: adminConfig.overrides,
    }
    const data = await adminFetch('/api/admin/availability', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(nextConfig),
    })

    adminConfig.defaultSlots = data.defaultSlots
    adminConfig.blockedWeekdays = data.blockedWeekdays
    adminConfig.overrides = data.overrides
    adminMessage.value = 'Availability saved.'
    await fetchAvailability()
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : 'Availability could not be saved.'
  }
}

const addOverride = async () => {
  if (!overrideDate.value) {
    adminError.value = 'Choose a date for the override.'
    return
  }

  adminConfig.overrides[overrideDate.value] = {
    status: overrideStatus.value,
    slots: [],
    note: overrideNote.value,
  }

  await saveAvailability()
  overrideDate.value = ''
  overrideNote.value = ''
}

const removeOverride = async (date: string) => {
  delete adminConfig.overrides[date]
  await saveAvailability()
}

const updateBookingStatus = async (booking: Booking, status: string) => {
  adminError.value = ''
  adminMessage.value = ''

  try {
    const data = await adminFetch(`/api/admin/bookings/${booking.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    booking.status = data.booking.status
    booking.updatedAt = data.booking.updatedAt
    adminMessage.value = 'Booking updated.'
    await fetchAvailability()
  } catch (error) {
    adminError.value = error instanceof Error ? error.message : 'Booking could not be updated.'
  }
}

onMounted(() => {
  if (isAdminView.value) {
    loadAdminData()
  } else {
    fetchAvailability()
  }
})
watch(currentMonthKey, fetchAvailability)
</script>

<template>
  <main v-if="isAdminView" class="admin-shell">
    <section v-if="!adminToken" class="admin-login" aria-labelledby="admin-login-title">
      <div>
        <p class="eyebrow">Admin</p>
        <h1 id="admin-login-title">805 Game Show control room</h1>
        <p>Log in to view booking responses and manage calendar availability.</p>
      </div>
      <form class="admin-login-form" @submit.prevent="loginAdmin">
        <label>
          Password
          <input v-model="adminPassword" type="password" autocomplete="current-password" required />
        </label>
        <button class="submit-button" type="submit">Log in</button>
        <p v-if="adminError" class="error-message">{{ adminError }}</p>
      </form>
    </section>

    <section v-else class="admin-dashboard">
      <header class="admin-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>Responses and availability</h1>
        </div>
        <div class="admin-header-actions">
          <a class="secondary-action admin-link" href="/">Public site</a>
          <button class="secondary-action admin-link" type="button" @click="logoutAdmin">Log out</button>
        </div>
      </header>

      <p v-if="adminMessage" class="success-message">{{ adminMessage }}</p>
      <p v-if="adminError" class="error-message">{{ adminError }}</p>

      <div class="admin-grid">
        <section class="admin-panel">
          <div class="panel-heading">
            <h2>Booking responses</h2>
            <button type="button" @click="loadAdminData">Refresh</button>
          </div>

          <article v-for="booking in adminBookings" :key="booking.id" class="booking-card">
            <div class="booking-card-top">
              <div>
                <strong>{{ booking.contact.name }}</strong>
                <span>{{ booking.contact.email }} · {{ booking.contact.phone || 'No phone' }}</span>
              </div>
              <select
                :value="booking.status"
                @change="updateBookingStatus(booking, ($event.target as HTMLSelectElement).value)"
              >
                <option>new</option>
                <option>contacted</option>
                <option>confirmed</option>
                <option>cancelled</option>
              </select>
            </div>
            <dl>
              <div>
                <dt>Date</dt>
                <dd>{{ readableDate(booking.event.date) }} at {{ booking.event.time }}</dd>
              </div>
              <div>
                <dt>Address</dt>
                <dd>
                  {{ booking.address.street }} {{ booking.address.unit }}
                  {{ booking.address.city }}, {{ booking.address.state }} {{ booking.address.zip }}
                </dd>
              </div>
              <div>
                <dt>Group</dt>
                <dd>{{ booking.event.guests }} guests · {{ booking.event.occasion }}</dd>
              </div>
              <div>
                <dt>Vibe</dt>
                <dd>{{ booking.event.vibe }}</dd>
              </div>
              <div v-if="booking.event.notes">
                <dt>Notes</dt>
                <dd>{{ booking.event.notes }}</dd>
              </div>
            </dl>
          </article>

          <p v-if="!adminBookings.length" class="calendar-help">No responses yet.</p>
        </section>

        <section class="admin-panel">
          <div class="panel-heading">
            <h2>Calendar availability</h2>
          </div>

          <form class="admin-form" @submit.prevent="saveAvailability">
            <fieldset class="weekday-fieldset">
              <legend>Blocked weekdays</legend>
              <label v-for="day in weekdayChoices" :key="day.value" class="checkbox-label">
                <input v-model="adminConfig.blockedWeekdays" type="checkbox" :value="day.value" />
                {{ day.label }}
              </label>
            </fieldset>

            <button class="submit-button" type="submit">Save blocked weekdays</button>
          </form>

          <form class="admin-form override-form" @submit.prevent="addOverride">
            <h3>Date override</h3>
            <label>
              Date
              <input v-model="overrideDate" type="date" />
            </label>
            <label>
              Status
              <select v-model="overrideStatus">
                <option value="available">available</option>
                <option value="limited">limited</option>
                <option value="blocked">blocked</option>
              </select>
            </label>
            <label>
              Note
              <input v-model="overrideNote" placeholder="Optional note" />
            </label>
            <button class="submit-button" type="submit">Save override</button>
          </form>

          <div class="override-list">
            <article v-for="rule in sortedOverrides" :key="rule.date">
              <div>
                <strong>{{ readableDate(rule.date) }}</strong>
                <span>{{ rule.status }}</span>
                <small v-if="rule.note">{{ rule.note }}</small>
              </div>
              <button type="button" @click="removeOverride(rule.date)">Remove</button>
            </article>
          </div>
        </section>
      </div>
    </section>
  </main>

  <main v-else class="site-shell">
    <section class="hero-section" aria-labelledby="hero-title">
      <nav class="topbar" aria-label="Primary navigation">
        <a class="brand" href="#top" aria-label="805 Game Show home">
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
        <span>Recommended party size</span>
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
          <p>Our experienced host runs the night with energy, humor, and command of the room.</p>
        </article>
        <article>
          <span class="feature-icon">02</span>
          <h3>Board, buzzers, and podiums</h3>
          <p>Our custom-built hardware and software can accommodate any location and group.</p>
        </article>
        <article>
          <span class="feature-icon">03</span>
          <h3>Tailored categories</h3>
          <p>
            Have your pick of over Y categories, or we'll work with you to create custom ones based
            on your group's interests.
          </p>
        </article>
      </div>
    </section>

    <section class="booking-section" id="booking" aria-labelledby="booking-title">
      <div class="booking-intro">
        <p class="eyebrow">Booking details</p>
        <h2 id="booking-title">Pick a date and tell us a bit about the party.</h2>
        <p>
          Fill out an interest form and our team will respond within 24 hours to confirm. We
          recommend at least two weeks notice for custom requests.
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
              Requested arrival time
              <select v-model="form.requestedTime" required>
                <option disabled value="">Choose a time</option>
                <option v-for="time in requestedTimeOptions" :key="time">{{ time }}</option>
              </select>
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

          <p v-if="bookingId" class="success-message">
            Request saved. Your booking ID is {{ bookingId }}.
          </p>
          <p v-if="submitError" class="error-message">{{ submitError }}</p>
          <button class="submit-button" type="submit" :disabled="!canSubmit">
            {{ isSubmitting ? 'Saving request...' : 'Request booking' }}
          </button>
        </form>

        <aside class="calendar-panel" aria-label="Date picker">
          <div class="calendar-toolbar">
            <button type="button" aria-label="Previous month" @click="shiftMonth(-1)">‹</button>
            <strong>{{ monthLabel }}</strong>
            <button type="button" aria-label="Next month" @click="shiftMonth(1)">›</button>
          </div>

          <p v-if="isLoadingAvailability" class="calendar-help">Loading availability...</p>

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
            <p v-if="selectedDate" class="calendar-help">
              Add your preferred arrival time in the form. We will confirm the exact schedule after
              reviewing the request.
            </p>
            <p v-else class="calendar-help">Select an open date to continue.</p>
            <p v-if="selectedAvailability?.note" class="calendar-help">
              {{ selectedAvailability.note }}
            </p>
          </div>

          <div class="booking-summary">
            <span>Estimated total</span>
            <strong>$350</strong>
            <p>Flat-rate in-home hosting. Payment handling can be attached after request approval.</p>
          </div>
        </aside>
      </div>
    </section>
  </main>
</template>
