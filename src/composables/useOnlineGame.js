import { ref, onUnmounted } from 'vue'
import { db } from '../firebase.js'
import {
  doc,
  setDoc,
  getDoc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore'

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export function useOnlineGame() {
  const roomId = ref(null)
  const myColor = ref(null) // 'w' | 'b'
  const opponentConnected = ref(false)
  const error = ref(null)
  const loading = ref(false)

  let unsubscribe = null

  async function createRoom(timeControl = null) {
    loading.value = true
    error.value = null
    const id = generateRoomId()
    const roomRef = doc(db, 'games', id)
    console.log('[createRoom] attempting to create room', id, 'projectId:', db.app.options.projectId)

    const initMs = timeControl ? timeControl.minutes * 60 * 1000 : null
    try {
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Connection timed out. Firestore may be blocked by your browser or ad blocker.')), 8000)
      )
      await Promise.race([
        setDoc(roomRef, {
          fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
          moves: [],
          white: true,
          black: false,
          createdAt: serverTimestamp(),
          lastMove: null,
          timeControl: timeControl ? { minutes: timeControl.minutes, increment: timeControl.increment ?? 0 } : null,
          clockWhiteMs: initMs,
          clockBlackMs: initMs,
          clockActiveSide: 'w',
          clockLastMoveAt: null,
        }),
        timeout,
      ])
      console.log('[createRoom] success, roomId:', id)
      roomId.value = id
      myColor.value = 'w'
    } catch (e) {
      console.error('[createRoom] error:', e)
      error.value = e.message
      loading.value = false
      return null
    }

    loading.value = false
    return id
  }

  async function joinRoom(id) {
    loading.value = true
    error.value = null
    const roomRef = doc(db, 'games', id)

    try {
      const snap = await getDoc(roomRef)
      if (!snap.exists()) {
        error.value = 'Room not found'
        loading.value = false
        return false
      }
      const data = snap.data()
      if (data.black) {
        error.value = 'Room is full'
        loading.value = false
        return false
      }

      await updateDoc(roomRef, { black: true })
      roomId.value = id
      myColor.value = 'b'
    } catch (e) {
      error.value = e.message
      loading.value = false
      return false
    }

    loading.value = false
    return true
  }

  function subscribeToRoom(id, onUpdate) {
    const roomRef = doc(db, 'games', id)
    unsubscribe = onSnapshot(roomRef, (snap) => {
      if (!snap.exists()) return
      const data = snap.data()
      opponentConnected.value = data.white && data.black
      onUpdate(data)
    })
  }

  async function pushMove(id, fen, move, clockData = null) {
    const roomRef = doc(db, 'games', id)
    // Firestore cannot serialize chess.js class instances — convert to plain object
    const plainMove = move ? { from: move.from, to: move.to, promotion: move.promotion ?? null } : null
    const update = { fen, lastMove: plainMove }
    if (clockData) {
      update.clockWhiteMs = clockData.whiteMs
      update.clockBlackMs = clockData.blackMs
      update.clockActiveSide = clockData.activeSide
      update.clockLastMoveAt = serverTimestamp()
    }
    try {
      await updateDoc(roomRef, update)
    } catch (e) {
      error.value = e.message
    }
  }

  async function pushResign(id, color) {
    const roomRef = doc(db, 'games', id)
    try {
      await updateDoc(roomRef, { resignedColor: color, status: 'resigned' })
    } catch (e) {
      error.value = e.message
    }
  }

  async function pushDraw(id) {
    const roomRef = doc(db, 'games', id)
    try {
      await updateDoc(roomRef, { status: 'draw' })
    } catch (e) {
      error.value = e.message
    }
  }

  function leaveRoom() {
    if (unsubscribe) {
      unsubscribe()
      unsubscribe = null
    }
    roomId.value = null
    myColor.value = null
    opponentConnected.value = false
  }

  onUnmounted(() => {
    if (unsubscribe) unsubscribe()
  })

  return {
    roomId,
    myColor,
    opponentConnected,
    error,
    loading,
    createRoom,
    joinRoom,
    subscribeToRoom,
    pushMove,
    pushResign,
    pushDraw,
    leaveRoom,
  }
}
