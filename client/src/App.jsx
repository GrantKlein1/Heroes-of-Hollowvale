import React from 'react'
import Game from './Game'
import { EventBus } from './game/EventBus'

// Ensure React ↔ game EventBus is initialized with the app shell
void EventBus

export default function App() {
  return (
    <Game />
  )
}
