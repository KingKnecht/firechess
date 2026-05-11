import { ref } from 'vue'

const CLIENT_ID = 'firechess'
const SCOPES = 'preference:read'
const TOKEN_KEY = 'lichess_token'
const USER_KEY = 'lichess_user'

export const lichessToken = ref(localStorage.getItem(TOKEN_KEY) ?? null)
export const lichessUser = ref(JSON.parse(localStorage.getItem(USER_KEY) ?? 'null'))
export const lichessAuthLoading = ref(false)

function generateVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateChallenge(verifier) {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function getRedirectUri() {
  return window.location.origin + window.location.pathname.replace(/\/$/, '')
}

export async function connectLichess() {
  const verifier = generateVerifier()
  const challenge = await generateChallenge(verifier)
  const redirectUri = getRedirectUri()

  sessionStorage.setItem('lichess_verifier', verifier)
  sessionStorage.setItem('lichess_redirect_uri', redirectUri)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
  })

  window.location.href = `https://lichess.org/oauth?${params}`
}

export async function handleLichessCallback(code) {
  const verifier = sessionStorage.getItem('lichess_verifier')
  const redirectUri = sessionStorage.getItem('lichess_redirect_uri') ?? getRedirectUri()

  sessionStorage.removeItem('lichess_verifier')
  sessionStorage.removeItem('lichess_redirect_uri')

  if (!verifier) return false

  lichessAuthLoading.value = true
  try {
    const resp = await fetch('https://lichess.org/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
    })

    if (!resp.ok) return false

    const { access_token } = await resp.json()
    if (!access_token) return false

    lichessToken.value = access_token
    localStorage.setItem(TOKEN_KEY, access_token)

    await fetchLichessUser()
    return true
  } catch {
    return false
  } finally {
    lichessAuthLoading.value = false
  }
}

export async function fetchLichessUser() {
  if (!lichessToken.value) return
  try {
    const resp = await fetch('https://lichess.org/api/account', {
      headers: { Authorization: `Bearer ${lichessToken.value}` },
    })
    if (resp.ok) {
      const data = await resp.json()
      const { id, username, perfs } = data
      // Pick highest-volume rated time control as the user's "main" rating
      const ratingCandidates = ['blitz', 'rapid', 'classical', 'bullet']
        .map(tc => perfs?.[tc])
        .filter(p => p?.games > 0 && p?.rating)
        .sort((a, b) => b.games - a.games)
      const rating = ratingCandidates[0]?.rating ?? null
      lichessUser.value = { id, username, rating }
      localStorage.setItem(USER_KEY, JSON.stringify({ id, username, rating }))
    } else {
      // Token invalid — clear it
      disconnectLichess()
    }
  } catch {}
}

export function disconnectLichess() {
  if (lichessToken.value) {
    fetch('https://lichess.org/api/token', {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${lichessToken.value}` },
    }).catch(() => {})
  }
  lichessToken.value = null
  lichessUser.value = null
  localStorage.removeItem(TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}
