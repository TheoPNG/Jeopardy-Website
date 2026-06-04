import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(__dirname, 'data')
const bookingsPath = path.join(dataDir, 'bookings.json')
const availabilityPath = path.join(dataDir, 'availability.json')
const distDir = path.join(__dirname, 'dist')

const port = Number(process.env.PORT || 4174)
const adminPassword = process.env.ADMIN_PASSWORD || 'jeopardy-admin'
const sessions = new Map()

const jsonHeaders = {
  'Content-Type': 'application/json',
}

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
}

const defaultAvailability = {
  defaultSlots: ['2:00 PM', '5:30 PM', '8:00 PM'],
  blockedWeekdays: [],
  overrides: {},
}

const sendJson = (res, status, body) => {
  res.writeHead(status, jsonHeaders)
  res.end(JSON.stringify(body))
}

const readJson = async (filePath, fallback) => {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'))
  } catch (error) {
    if (error.code === 'ENOENT') return fallback
    throw error
  }
}

const writeJson = async (filePath, data) => {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

const readBody = async (req) => {
  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 1_000_000) throw new Error('Request body is too large.')
  }
  return body ? JSON.parse(body) : {}
}

const dateKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const addDays = (date, days) => {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

const parseMonth = (month) => {
  const match = /^(\d{4})-(\d{2})$/.exec(month || '')
  if (!match) return new Date()
  return new Date(Number(match[1]), Number(match[2]) - 1, 1)
}

const visibleCalendarDates = (month) => {
  const first = parseMonth(month)
  const start = new Date(first)
  start.setDate(first.getDate() - first.getDay())
  return Array.from({ length: 42 }, (_, index) => addDays(start, index))
}

const getBookings = async () => readJson(bookingsPath, [])
const getAvailabilityConfig = async () => readJson(availabilityPath, defaultAvailability)

const buildAvailability = async (month) => {
  const config = await getAvailabilityConfig()
  const bookings = await getBookings()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  return visibleCalendarDates(month).map((date) => {
    const key = dateKey(date)
    const override = config.overrides?.[key]
    const isPast = date < today
    const weekdayBlocked = config.blockedWeekdays?.includes(date.getDay())
    const bookingCount = bookings.filter(
      (booking) => booking.status !== 'cancelled' && booking.event?.date === key,
    ).length
    const forcedStatus = override?.status

    let status = forcedStatus || (weekdayBlocked ? 'blocked' : bookingCount > 0 ? 'limited' : 'available')
    if (isPast) status = 'blocked'

    return {
      date: key,
      status,
      slots: [],
      note: override?.note,
    }
  })
}

const requireAdmin = (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  const expiresAt = token ? sessions.get(token) : 0

  if (!token || !expiresAt || expiresAt < Date.now()) {
    sendJson(res, 401, { message: 'Admin login required.' })
    return false
  }

  return true
}

const validateBooking = (payload) => {
  const required = [
    payload?.contact?.name,
    payload?.contact?.email,
    payload?.address?.street,
    payload?.address?.city,
    payload?.address?.state,
    payload?.address?.zip,
    payload?.event?.date,
    payload?.event?.time,
  ]

  if (required.some((value) => !String(value || '').trim())) {
    return 'Please complete all required fields.'
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.event.date)) {
    return 'Please choose a valid event date.'
  }

  return ''
}

const handleApi = async (req, res, url) => {
  if (req.method === 'GET' && url.pathname === '/api/health') {
    sendJson(res, 200, { ok: true })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/availability') {
    sendJson(res, 200, { days: await buildAvailability(url.searchParams.get('month')) })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/bookings') {
    const payload = await readBody(req)
    const validationError = validateBooking(payload)
    if (validationError) {
      sendJson(res, 400, { message: validationError })
      return true
    }

    const matchingDay = (await buildAvailability(payload.event.date.slice(0, 7))).find(
      (day) => day.date === payload.event.date,
    )

    if (!matchingDay || matchingDay.status === 'blocked') {
      sendJson(res, 409, { message: 'That date is no longer available.' })
      return true
    }

    const booking = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      status: 'new',
      ...payload,
    }
    const bookings = await getBookings()
    bookings.unshift(booking)
    await writeJson(bookingsPath, bookings)
    sendJson(res, 201, { bookingId: booking.id, booking })
    return true
  }

  if (req.method === 'POST' && url.pathname === '/api/admin/login') {
    const body = await readBody(req)
    if (body.password !== adminPassword) {
      sendJson(res, 401, { message: 'Incorrect password.' })
      return true
    }

    const token = randomUUID()
    sessions.set(token, Date.now() + 1000 * 60 * 60 * 12)
    sendJson(res, 200, { token })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/bookings') {
    if (!requireAdmin(req, res)) return true
    sendJson(res, 200, { bookings: await getBookings() })
    return true
  }

  if (req.method === 'PUT' && url.pathname.startsWith('/api/admin/bookings/')) {
    if (!requireAdmin(req, res)) return true
    const bookingId = decodeURIComponent(url.pathname.split('/').pop())
    const body = await readBody(req)
    const bookings = await getBookings()
    const booking = bookings.find((item) => item.id === bookingId)

    if (!booking) {
      sendJson(res, 404, { message: 'Booking not found.' })
      return true
    }

    booking.status = body.status || booking.status
    booking.updatedAt = new Date().toISOString()
    await writeJson(bookingsPath, bookings)
    sendJson(res, 200, { booking })
    return true
  }

  if (req.method === 'GET' && url.pathname === '/api/admin/availability') {
    if (!requireAdmin(req, res)) return true
    sendJson(res, 200, await getAvailabilityConfig())
    return true
  }

  if (req.method === 'PUT' && url.pathname === '/api/admin/availability') {
    if (!requireAdmin(req, res)) return true
    const body = await readBody(req)
    const nextConfig = {
      defaultSlots: Array.isArray(body.defaultSlots) ? body.defaultSlots.filter(Boolean) : [],
      blockedWeekdays: Array.isArray(body.blockedWeekdays) ? body.blockedWeekdays : [],
      overrides: body.overrides && typeof body.overrides === 'object' ? body.overrides : {},
    }
    await writeJson(availabilityPath, nextConfig)
    sendJson(res, 200, nextConfig)
    return true
  }

  if (url.pathname.startsWith('/api/')) {
    sendJson(res, 404, { message: 'API route not found.' })
    return true
  }

  return false
}

const serveStatic = async (req, res, url) => {
  const pathname = url.pathname === '/' || url.pathname === '/admin' ? '/index.html' : url.pathname
  const requestedPath = path.normalize(path.join(distDir, pathname))
  const safePath = requestedPath.startsWith(distDir) ? requestedPath : path.join(distDir, 'index.html')

  try {
    const fileInfo = await stat(safePath)
    const filePath = fileInfo.isFile() ? safePath : path.join(distDir, 'index.html')
    const extension = path.extname(filePath)
    res.writeHead(200, { 'Content-Type': mimeTypes[extension] || 'application/octet-stream' })
    res.end(await readFile(filePath))
  } catch {
    res.writeHead(200, { 'Content-Type': 'text/html' })
    res.end(await readFile(path.join(distDir, 'index.html')))
  }
}

await mkdir(dataDir, { recursive: true })
if (!(await readJson(availabilityPath, null))) {
  await writeJson(availabilityPath, defaultAvailability)
}

createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host}`)

  try {
    if (await handleApi(req, res, url)) return
    await serveStatic(req, res, url)
  } catch (error) {
    sendJson(res, 500, { message: error.message || 'Server error.' })
  }
}).listen(port, () => {
  console.log(`Jeopardy site listening on http://127.0.0.1:${port}`)
  console.log(`Admin login: http://127.0.0.1:${port}/admin`)
  console.log('Default admin password: jeopardy-admin')
})
