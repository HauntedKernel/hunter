import { useSpring, animated } from '@react-spring/web'
import { useDrag } from '@use-gesture/react'
import { useState } from 'react'

const SwipeCard = ({ children, onSwipeLeft, onSwipeRight, onSwipeUp, index = 0 }) => {
  const [gone, setGone] = useState(false)
  
  const [{ x, y, rot, scale }, api] = useSpring(() => ({
    x: 0,
    y: 0,
    rot: 0,
    scale: 1,
    config: { friction: 50, tension: 800 }
  }))

  const bind = useDrag(({ down, movement: [mx, my], velocity: [vx, vy], direction: [dx, dy] }) => {
    const trigger = Math.abs(vx) > 0.2
    const dir = dx < 0 ? -1 : 1
    const isGone = !down && trigger && Math.abs(mx) > 100

    if (!down && trigger && my < -100) {
      setGone(true)
      api.start({
        x: 0,
        y: -500,
        rot: 0,
        scale: 0.8,
        config: { friction: 60, tension: 500 }
      })
      setTimeout(() => onSwipeUp && onSwipeUp(), 200)
      return
    }

    if (isGone) {
      setGone(true)
      const callback = dir === 1 ? onSwipeRight : onSwipeLeft
      api.start({
        x: (200 + window.innerWidth) * dir,
        rot: dir * 10,
        scale: 0.8,
        config: { friction: 60, tension: 500 }
      })
      setTimeout(() => callback && callback(), 200)
    } else if (down) {
      api.start({
        x: mx,
        y: my,
        rot: mx / 100,
        scale: 1.1,
        immediate: (name) => down && (name === 'x' || name === 'y')
      })
    } else {
      api.start({
        x: 0,
        y: 0,
        rot: 0,
        scale: 1
      })
    }
  })

  const overlayOpacity = x.to([-200, 0, 200], [1, 0, 1])
  const overlayColor = x.to([-200, 0, 200], ['#ef4444', 'transparent', '#10b981'])
  const overlayText = x.to([-200, 0, 200], ['PASS', '', 'SELECT'])

  return (
    <animated.div
      {...bind()}
      style={{
        x,
        y,
        transform: rot.to((r) => `rotate(${r}deg)`),
        scale,
        position: 'absolute',
        width: '100%',
        height: '100%',
        willChange: 'transform',
        cursor: 'grab',
        userSelect: 'none',
        touchAction: 'none'
      }}
    >
      {children}
      <animated.div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          borderRadius: 20,
          pointerEvents: 'none',
          opacity: overlayOpacity,
          background: overlayColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <animated.span
          style={{
            color: 'white',
            fontSize: 48,
            fontWeight: 'bold',
            transform: x.to((x) => `translateX(${x > 0 ? -x / 4 : -x / 4}px)`),
            textShadow: '0 2px 10px rgba(0,0,0,0.3)'
          }}
        >
          {overlayText}
        </animated.span>
      </animated.div>
    </animated.div>
  )
}

export default SwipeCard